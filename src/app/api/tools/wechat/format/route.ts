import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * POST /api/tools/wechat/format
 * 公众号文章格式化工具
 * 使用 wechat_article.html 模板格式化文章内容
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { title, content, author, date } = body;

    // 验证必填字段（content 必填，title 可自动提取）
    if (!content) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必填字段：content 是必填的',
        },
        { status: 400 }
      );
    }

    // 🔴 自动从 content 中提取标题（如果 title 未提供）
    if (!title) {
      // 尝试从 markdown 标题提取（# 标题）
      const markdownTitleMatch = content.match(/^#\s+(.+?)[\n\r]/m);
      if (markdownTitleMatch) {
        title = markdownTitleMatch[1].trim();
        // 从 content 中移除 markdown 标题
        content = content.replace(/^#\s+.+?[\n\r]+/, '');
        console.log(`[WeChat Format] 自动从 markdown 提取标题: ${title}`);
      } else {
        // 尝试从纯文本第一行提取（假设第一行是标题）
        const lines = content.split(/[\n\r]/);
        const firstLine = lines[0]?.trim();
        if (firstLine && firstLine.length <= 50) {
          title = firstLine;
          content = lines.slice(1).join('\n').trim();
          console.log(`[WeChat Format] 自动从首行提取标题: ${title}`);
        } else {
          title = '无标题';
          console.warn(`[WeChat Format] 无法自动提取标题，使用默认值: 无标题`);
        }
      }
    }

    // 读取模板文件
    const templatePath = path.join(
      process.cwd(),
      'src',
      'templates',
      'wechat_article.html'
    );
    
    let template: string;
    try {
      template = fs.readFileSync(templatePath, 'utf-8');
    } catch (error) {
      console.error('[WeChat Format] 读取模板文件失败:', error);
      return NextResponse.json(
        {
          success: false,
          error: '无法读取模板文件',
        },
        { status: 500 }
      );
    }

    // 处理日期，默认为今天
    const formattedDate = date || new Date().toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // 处理作者，默认为空
    const formattedAuthor = author || '';

    // 格式化内容 - 将换行符转换为 <p> 标签
    const formattedContent = formatContentForWechat(content);

    // 替换模板变量
    const formattedHtml = template
      .replace(/\{\{title\}\}/g, escapeHtml(title))
      .replace(/\{\{author\}\}/g, escapeHtml(formattedAuthor))
      .replace(/\{\{date\}\}/g, escapeHtml(formattedDate))
      .replace(/\{\{content\}\}/g, formattedContent);

    return NextResponse.json({
      success: true,
      data: {
        formattedHtml,
        metadata: {
          title,
          author: formattedAuthor,
          date: formattedDate,
          originalLength: content.length,
          formattedLength: formattedHtml.length,
        },
      },
    });
  } catch (error) {
    console.error('[WeChat Format] 格式化失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '文章格式化失败',
      },
      { status: 500 }
    );
  }
}

/**
 * 格式化文章内容适配公众号
 * 将纯文本内容转换为 HTML 格式
 * 支持：
 * - 【加粗文字】自动转换为 <strong> 标签
 * - 编号列表 1. 2. 3. 自动格式化
 * - 连续换行转为段落分隔
 */
function formatContentForWechat(content: string): string {
  if (!content) return '';

  // 1. 规范化换行符
  let formatted = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. 将连续多个换行符转换为段落分隔
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  // 3. 将每个段落用 <p> 标签包裹
  const paragraphs = formatted.split('\n\n').filter(p => p.trim());
  
  if (paragraphs.length === 0) {
    // 如果没有段落分隔，按单行处理
    const lines = formatted.split('\n').filter(l => l.trim());
    return lines.map(line => `<p>${formatInlineWithBold(line.trim())}</p>`).join('\n');
  }

  return paragraphs.map(paragraph => {
    const trimmed = paragraph.trim();
    if (!trimmed) return '';
    
    // 处理编号列表行（如 "1. xxx" 或 "1、xxx"）
    if (/^[一二三四五六七八九十百\d]+[.、\s]/.test(trimmed)) {
      return formatListItem(trimmed);
    }
    
    // 处理小标题行（如 "一、xxx" 或 "（一）xxx"）
    if (/^[一二三四五六七八九十]+[、\s]/.test(trimmed) || /^[（\(][一二三四五六七八九十\d]+[）\)]/.test(trimmed)) {
      return `<p style="font-weight:bold;color:#1a1a1a;margin:20px 0 10px;">${formatInlineWithBold(trimmed)}</p>`;
    }
    
    // 普通段落：段落内部的换行用 <br> 处理
    const paragraphWithBreaks = trimmed
      .split('\n')
      .map(line => formatInlineWithBold(line.trim()))
      .filter(line => line)
      .join('<br>\n');
    
    return `<p>${paragraphWithBreaks}</p>`;
  }).join('\n');
}

/**
 * HTML 转义（基础版）
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 格式化行内元素（先处理加粗，再转义其他 HTML）
 */
function formatInlineWithBold(text: string): string {
  // 1. 先将【加粗】转换为 <strong> 标签
  let result = text.replace(/【([^】]+)】/g, '<strong>$1</strong>');
  
  // 2. 再转义其他 HTML 特殊字符（但保留我们刚加的 <strong> 标签）
  // 使用更安全的转义，只转义 & 字符，然后处理其他字符
  result = result.replace(/&/g, '&amp;');
  // 把转义后的 &lt; &gt; &quot; 还原（因为这些是我们标签的一部分）
  result = result.replace(/&amp;lt;/g, '&lt;');
  result = result.replace(/&amp;gt;/g, '&gt;');
  result = result.replace(/&amp;quot;/g, '&quot;');
  result = result.replace(/&amp;#039;/g, '&#039;');
  
  return result;
}

/**
 * 格式化编号列表项
 */
function formatListItem(text: string): string {
  const lines = text.split('\n');
  return lines.map(line => {
    const trimmed = line.trim();
    if (/^[一二三四五六七八九十百\d]+[.、\s]/.test(trimmed)) {
      return `<p style="margin:8px 0 8px 20px;text-indent:-10px;">${formatInlineWithBold(trimmed)}</p>`;
    }
    return `<p>${formatInlineWithBold(trimmed)}</p>`;
  }).join('\n');
}
