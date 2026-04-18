/**
 * URL 文章抓取和学习 API
 * POST /api/style-analyzer/fetch-and-learn
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { styleAnalyzer, styleLearner } from '@/lib/style-analyzer';

/**
 * 从 URL 获取文章内容
 */
async function fetchArticleFromURL(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      signal: AbortSignal.timeout(30000), // 30 秒超时
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();

    // 提取文章正文（简化版，实际可以使用更复杂的解析库）
    const articleContent = extractArticleContent(html);
    return articleContent;
  } catch (error: any) {
    throw new Error(`抓取文章失败: ${error.message}`);
  }
}

/**
 * 从 HTML 中提取文章正文（简化版）
 */
function extractArticleContent(html: string): string {
  // 移除 script、style 等标签
  let cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n');

  // 移除多余的空白字符
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // 分段（根据句号、问号、感叹号）
  const paragraphs = cleaned
    .split(/[。！？\n]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 10);

  // 返回前 2000 字符的内容（可根据需要调整）
  return paragraphs.slice(0, 10).join('。');
}

/**
 * POST /api/style-analyzer/fetch-and-learn
 * 从 URL 抓取文章并学习风格
 */
export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const body = await request.json();
    const { urls, categoryName, agent } = body;

    // 参数验证
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误：urls 必须是非空数组',
        },
        { status: 400 }
      );
    }

    if (urls.length > 10) {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误：单次最多支持 10 个 URL',
        },
        { status: 400 }
      );
    }

    // 验证 URL 格式
    for (let i = 0; i < urls.length; i++) {
      try {
        new URL(urls[i]);
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: `参数错误：第 ${i + 1} 个 URL 格式无效`,
          },
          { status: 400 }
        );
      }
    }

    // 抓取文章
    const articles: string[] = [];
    const errors: Array<{ url: string; error: string }> = [];

    for (const url of urls) {
      try {
        const content = await fetchArticleFromURL(url);
        if (content.length < 100) {
          throw new Error('文章内容过短');
        }
        articles.push(content);
      } catch (error: any) {
        errors.push({ url, error: error.message });
      }
    }

    if (articles.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '未能成功抓取任何文章',
          errors,
        },
        { status: 500 }
      );
    }

    // 执行风格分析
    const analysisResult = await styleAnalyzer.analyzeStyle({
      articles,
      categoryName: categoryName || '通用',
    });

    // 保存风格模板
    styleLearner.saveTemplate(analysisResult.template);

    return NextResponse.json({
      success: true,
      data: {
        template: analysisResult.template,
        summary: analysisResult.summary,
        recommendations: analysisResult.recommendations,
        statistics: {
          totalUrls: urls.length,
          successCount: articles.length,
          failCount: errors.length,
        },
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error: any) {
    console.error('URL 学习失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'URL 学习失败',
      },
      { status: 500 }
    );
  }
}
