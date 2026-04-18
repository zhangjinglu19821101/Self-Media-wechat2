/**
 * 微信公众号 MCP 工具封装
 * 
 * 为 MCP Server 提供微信公众号相关的工具
 * 支持：添加草稿、获取草稿列表、删除草稿、上传素材、获取账号列表
 * 
 * @docs /docs/详细设计文档agent智能交互MCP能力设计capability_type.md
 */

import {
  getAccessToken,
  addDraft,
  getDraftList,
  deleteDraft,
  uploadMedia,
  uploadPermanentThumb,
} from '@/lib/wechat-official-account/api';
import fs from 'fs';
import path from 'path';

import {
  getEnabledAccounts,
  getAccountById,
  getDraftDefaults,
  type WechatOfficialAccount,
  type WechatDraft,
} from '@/config/wechat-official-account.config';

// === 类型定义 ===

export interface WechatMCPResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    accountId?: string;
    accountName?: string;
    timestamp: number;
  };
}

export interface WechatAddDraftParams {
  accountId: string;
  articles: WechatDraft[];
}

export interface WechatGetDraftListParams {
  accountId: string;
  offset?: number;
  count?: number;
}

export interface WechatDeleteDraftParams {
  accountId: string;
  mediaId: string;
}

export interface WechatUploadMediaParams {
  accountId: string;
  mediaType: 'image';
  fileUrl?: string;
  fileBase64?: string;
}

export interface WechatFormatArticleParams {
  accountId: string;
  title: string;
  content: string;
  author?: string;
  date?: string;
}

// === 工具函数 ===

/**
 * 获取可用的微信公众号账号列表
 */
export async function wechatGetAccounts(): Promise<WechatMCPResult<WechatOfficialAccount[]>> {
  console.log('[MCP Tool] wechatGetAccounts 开始执行');
  const startTime = Date.now();
  
  try {
    const accounts = getEnabledAccounts();
    
    // 隐藏敏感信息
    const safeAccounts = accounts.map(account => ({
      ...account,
      appSecret: '***', // 隐藏 AppSecret
    }));

    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`[MCP Tool] wechatGetAccounts 执行完成，耗时 ${duration}ms，结果:`, { success: true, accountCount: safeAccounts.length });
    
    return {
      success: true,
      data: safeAccounts,
      metadata: {
        timestamp: Date.now(),
      },
    };
  } catch (error: any) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.error(`[MCP Tool] wechatGetAccounts 执行失败，耗时 ${duration}ms，错误:`, error.message);
    
    return {
      success: false,
      error: `获取账号列表失败: ${error.message}`,
      metadata: {
        timestamp: Date.now(),
      },
    };
  }
}

/**
 * 添加微信公众号草稿
 * 
 * 🔥 自动应用默认配置：
 * 如果 articles 中没有传 author/need_open_comment 等字段，
 * 会自动从 getDraftDefaults() 获取默认值并填充
 */
export async function wechatAddDraft(params: WechatAddDraftParams): Promise<WechatMCPResult<{ media_id: string; create_time: number }>> {
  console.log('[MCP Tool] wechatAddDraft 开始执行，参数:', { ...params, articlesCount: params.articles?.length });
  const startTime = Date.now();
  
  try {
    const { accountId, articles } = params;

    // 验证参数
    if (!accountId) {
      return {
        success: false,
        error: '缺少 accountId 参数',
        metadata: { timestamp: Date.now() },
      };
    }

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return {
        success: false,
        error: '缺少 articles 参数或格式错误',
        metadata: { timestamp: Date.now() },
      };
    }

    // 获取公众号账号
    const account = getAccountById(accountId);
    if (!account) {
      return {
        success: false,
        error: `未找到账号: ${accountId}`,
        metadata: { timestamp: Date.now() },
      };
    }

    if (!account.enabled) {
      return {
        success: false,
        error: `账号未启用: ${accountId}`,
        metadata: { timestamp: Date.now() },
      };
    }

    // 🔥🔥🔥 自动应用默认配置
    const draftDefaults = getDraftDefaults(accountId);

    // 🔴 自动检测并转换 markdown 内容到 HTML + 应用默认配置
    // 如果 content 包含 markdown 特征（如 **, ##, -, > 等），自动转换
    const articlesWithFormattedContent = await Promise.all(
      articles.map(async (article, index) => {
        let formattedContent = article.content;
        
        // 检测是否为 markdown 内容
        const isMarkdown = /(\*\*|#{1,6}|- |\d+\. |> |`{1,3})/.test(article.content);
        
        if (isMarkdown && article.content.trim()) {
          console.log(`[MCP Tool] 文章 ${index + 1} 检测到 markdown 内容，自动转换`);
          formattedContent = formatContentForWechat(article.content);
          console.log(`[MCP Tool] 文章 ${index + 1} 转换完成，原始长度: ${article.content.length}, 转换后长度: ${formattedContent.length}`);
        }
        
        return {
          ...article,
          content: formattedContent
        };
      })
    );

    // 🔥🔥🔥 自动应用默认配置（用户没传的字段用默认值填充）
    const articlesWithDefaults = articlesWithFormattedContent.map((article) => ({
      ...article,
      author: article.author || draftDefaults.author || account.defaultAuthor,
      need_open_comment: article.need_open_comment ?? (draftDefaults.needOpenComment ?? 1),
      only_fans_can_comment: article.only_fans_can_comment ?? (draftDefaults.onlyFansCanComment ?? 0),
      show_cover_pic: article.show_cover_pic ?? (draftDefaults.showCoverPic ?? 0),
    }));

    // 🔴 自动补充 thumb_media_id：如果文章没有封面图片，需要上传永久缩略图
    // 微信公众号要求 thumb_media_id 必须是永久素材的 ID
    const articlesWithThumb = await Promise.all(
      articlesWithDefaults.map(async (article, index) => {
        if (article.thumb_media_id) {
          return article;  // 已有封面
        }
        
        console.log(`[MCP Tool] 文章 ${index + 1} 没有封面图片，上传永久缩略图`);
        
        try {
          // 下载默认封面图片
          const thumbResponse = await fetch('https://code.coze.cn/api/sandbox/coze_coding/file/proxy?expire_time=-1&file_path=assets%2F1774631936856.jpg&nonce=2028a82c-3c17-4dc8-8ece-5641a0d95db3&project_id=7601333505219002402&sign=25d962af92bff1d8f96b502598d1a893ea2d7a0fe937284647bca7c4cb8a5ac6');
          
          if (thumbResponse.ok) {
            const arrayBuffer = await thumbResponse.arrayBuffer();
            const thumbBuffer = Buffer.from(arrayBuffer);
            
            // 上传到永久素材
            const thumbResult = await uploadPermanentThumb(account, thumbBuffer);
            
            console.log(`[MCP Tool] 永久缩略图上传成功，media_id: ${thumbResult.mediaId}`);
            
            return {
              ...article,
              thumb_media_id: thumbResult.mediaId,
              show_cover_pic: 1 as const,  // 显示封面，as const 确保类型为 0 | 1
            };
          } else {
            console.warn(`[MCP Tool] 下载默认封面失败: ${thumbResponse.status}`);
            return {
              ...article,
              show_cover_pic: 0 as const,  // 不显示封面
            };
          }
        } catch (thumbError: any) {
          console.error(`[MCP Tool] 上传永久缩略图失败: ${thumbError.message}`);
          return {
            ...article,
            show_cover_pic: 0 as const,  // 不显示封面
          };
        }
      })
    );

    // 调用 API 添加草稿
    const result = await addDraft(account, articlesWithThumb);

    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`[MCP Tool] wechatAddDraft 执行完成，耗时 ${duration}ms，结果:`, { success: true, mediaId: result.media_id });
    
    return {
      success: true,
      data: result,
      metadata: {
        accountId: account.id,
        accountName: account.name,
        timestamp: Date.now(),
      },
    };
  } catch (error: any) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.error(`[MCP Tool] wechatAddDraft 执行失败，耗时 ${duration}ms，错误:`, error.message);
    
    return {
      success: false,
      error: `添加草稿失败: ${error.message}`,
      metadata: {
        timestamp: Date.now(),
      },
    };
  }
}

/**
 * 获取微信公众号草稿列表
 */
export async function wechatGetDraftList(params: WechatGetDraftListParams): Promise<WechatMCPResult<any>> {
  console.log('[MCP Tool] wechatGetDraftList 开始执行，参数:', params);
  const startTime = Date.now();
  
  try {
    const { accountId, offset = 0, count = 20 } = params;

    // 验证参数
    if (!accountId) {
      return {
        success: false,
        error: '缺少 accountId 参数',
        metadata: { timestamp: Date.now() },
      };
    }

    // 获取公众号账号
    const account = getAccountById(accountId);
    if (!account) {
      return {
        success: false,
        error: `未找到账号: ${accountId}`,
        metadata: { timestamp: Date.now() },
      };
    }

    if (!account.enabled) {
      return {
        success: false,
        error: `账号未启用: ${accountId}`,
        metadata: { timestamp: Date.now() },
      };
    }

    // 调用 API 获取草稿列表
    const result = await getDraftList(account, offset, count);

    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`[MCP Tool] wechatGetDraftList 执行完成，耗时 ${duration}ms，结果:`, { success: true, dataSize: JSON.stringify(result).length });
    
    return {
      success: true,
      data: result,
      metadata: {
        accountId: account.id,
        accountName: account.name,
        timestamp: Date.now(),
      },
    };
  } catch (error: any) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.error(`[MCP Tool] wechatGetDraftList 执行失败，耗时 ${duration}ms，错误:`, error.message);
    
    return {
      success: false,
      error: `获取草稿列表失败: ${error.message}`,
      metadata: {
        timestamp: Date.now(),
      },
    };
  }
}

/**
 * 删除微信公众号草稿
 */
export async function wechatDeleteDraft(params: WechatDeleteDraftParams): Promise<WechatMCPResult<boolean>> {
  console.log('[MCP Tool] wechatDeleteDraft 开始执行，参数:', params);
  const startTime = Date.now();
  
  try {
    const { accountId, mediaId } = params;

    // 验证参数
    if (!accountId) {
      return {
        success: false,
        error: '缺少 accountId 参数',
        metadata: { timestamp: Date.now() },
      };
    }

    if (!mediaId) {
      return {
        success: false,
        error: '缺少 mediaId 参数',
        metadata: { timestamp: Date.now() },
      };
    }

    // 获取公众号账号
    const account = getAccountById(accountId);
    if (!account) {
      return {
        success: false,
        error: `未找到账号: ${accountId}`,
        metadata: { timestamp: Date.now() },
      };
    }

    if (!account.enabled) {
      return {
        success: false,
        error: `账号未启用: ${accountId}`,
        metadata: { timestamp: Date.now() },
      };
    }

    // 调用 API 删除草稿
    const result = await deleteDraft(account, mediaId);

    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`[MCP Tool] wechatDeleteDraft 执行完成，耗时 ${duration}ms，结果:`, { success: true, deleted: result });
    
    return {
      success: true,
      data: result,
      metadata: {
        accountId: account.id,
        accountName: account.name,
        timestamp: Date.now(),
      },
    };
  } catch (error: any) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.error(`[MCP Tool] wechatDeleteDraft 执行失败，耗时 ${duration}ms，错误:`, error.message);
    
    return {
      success: false,
      error: `删除草稿失败: ${error.message}`,
      metadata: {
        timestamp: Date.now(),
      },
    };
  }
}

/**
 * 上传微信公众号图片素材
 */
export async function wechatUploadMedia(params: WechatUploadMediaParams): Promise<WechatMCPResult<{ mediaId: string; url: string }>> {
  console.log('[MCP Tool] wechatUploadMedia 开始执行，参数:', { accountId: params.accountId, mediaType: params.mediaType, hasFileUrl: !!params.fileUrl, hasFileBase64: !!params.fileBase64 });
  const startTime = Date.now();
  
  try {
    const { accountId, mediaType = 'image', fileUrl, fileBase64 } = params;

    // 验证参数
    if (!accountId) {
      return {
        success: false,
        error: '缺少 accountId 参数',
        metadata: { timestamp: Date.now() },
      };
    }

    if (!fileUrl && !fileBase64) {
      return {
        success: false,
        error: '需要提供 fileUrl 或 fileBase64 参数',
        metadata: { timestamp: Date.now() },
      };
    }

    // 获取公众号账号
    const account = getAccountById(accountId);
    if (!account) {
      return {
        success: false,
        error: `未找到账号: ${accountId}`,
        metadata: { timestamp: Date.now() },
      };
    }

    if (!account.enabled) {
      return {
        success: false,
        error: `账号未启用: ${accountId}`,
        metadata: { timestamp: Date.now() },
      };
    }

    // 获取文件内容
    let fileBuffer: Buffer;
    let detectedMimeType = 'image/jpeg';  // 默认值
    if (fileUrl) {
      // 从 URL 下载文件
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`下载文件失败: ${response.status} ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      
      // 检测实际的文件类型（根据 magic bytes）
      const magic = fileBuffer.slice(0, 8);
      if (magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4E && magic[3] === 0x47) {
        detectedMimeType = 'image/png';
        console.log('[MCP Tool] 检测到 PNG 格式');
      } else if (magic[0] === 0xFF && magic[1] === 0xD8 && magic[2] === 0xFF) {
        detectedMimeType = 'image/jpeg';
        console.log('[MCP Tool] 检测到 JPEG 格式');
      }
    } else if (fileBase64) {
      // 从 Base64 解码
      const base64Data = fileBase64.replace(/^data:image\/\w+;base64,/, '');
      fileBuffer = Buffer.from(base64Data, 'base64');
      
      // 检测实际的文件类型（根据 magic bytes）
      const magic = fileBuffer.slice(0, 8);
      if (magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4E && magic[3] === 0x47) {
        detectedMimeType = 'image/png';
        console.log('[MCP Tool] 检测到 PNG 格式');
      } else if (magic[0] === 0xFF && magic[1] === 0xD8 && magic[2] === 0xFF) {
        detectedMimeType = 'image/jpeg';
        console.log('[MCP Tool] 检测到 JPEG 格式');
      }
    } else {
      throw new Error('需要提供 fileUrl 或 fileBase64 参数');
    }
    
    console.log('[MCP Tool] 检测到的 MIME 类型:', detectedMimeType);

    // 调用 API 上传素材
    const result = await uploadMedia(account, mediaType, fileBuffer);

    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`[MCP Tool] wechatUploadMedia 执行完成，耗时 ${duration}ms，结果:`, { success: true, mediaId: result.mediaId });
    
    return {
      success: true,
      data: result,
      metadata: {
        accountId: account.id,
        accountName: account.name,
        timestamp: Date.now(),
      },
    };
  } catch (error: any) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.error(`[MCP Tool] wechatUploadMedia 执行失败，耗时 ${duration}ms，错误:`, error.message);
    
    return {
      success: false,
      error: `上传素材失败: ${error.message}`,
      metadata: {
        timestamp: Date.now(),
      },
    };
  }
}

/**
 * 格式化公众号文章
 */
export async function wechatFormatArticle(params: WechatFormatArticleParams): Promise<WechatMCPResult<{ formattedHtml: string; metadata: any }>> {
  console.log('[MCP Tool] wechatFormatArticle 开始执行，参数:', { 
    accountId: params.accountId, 
    title: params.title, 
    contentLength: params.content?.length,
    author: params.author,
    date: params.date 
  });
  const startTime = Date.now();
  
  try {
    let { accountId, title, content, author, date } = params;

    // 验证参数
    if (!accountId) {
      return {
        success: false,
        error: '缺少 accountId 参数',
        metadata: { timestamp: Date.now() },
      };
    }

    if (!content) {
      return {
        success: false,
        error: '缺少 content 参数',
        metadata: { timestamp: Date.now() },
      };
    }

    // 🔴 自动从 content 中提取标题（如果 title 未提供）
    if (!title) {
      // 尝试从 markdown 标题提取（# 标题）
      const markdownTitleMatch = content.match(/^#\s+(.+?)[\n\r]/m);
      if (markdownTitleMatch) {
        title = markdownTitleMatch[1].trim();
        // 从 content 中移除 markdown 标题
        content = content.replace(/^#\s+.+?[\n\r]+/, '');
        console.log(`[MCP Tool] 自动从 markdown 提取标题: ${title}`);
      } else {
        // 尝试从纯文本第一行提取（假设第一行是标题）
        const firstLine = content.split(/[\n\r]/)[0]?.trim();
        if (firstLine && firstLine.length <= 50) {
          title = firstLine;
          content = content.substring(content.indexOf('\n') + 1).trim();
          console.log(`[MCP Tool] 自动从首行提取标题: ${title}`);
        } else {
          title = '无标题';
          console.warn(`[MCP Tool] 无法自动提取标题，使用默认值: 无标题`);
        }
      }
    }

    // 读取模板 - 优先从数据库获取默认模板
    let template: string;
    let templateSource: string;
    
    try {
      // 动态导入模板服务，避免循环依赖
      const { getDefaultTemplate } = await import('@/lib/template/service');
      const defaultTemplate = await getDefaultTemplate('公众号');
      
      if (defaultTemplate) {
        template = defaultTemplate.htmlContent;
        templateSource = `数据库默认模板: ${defaultTemplate.name}`;
        console.log(`[MCP Tool] 使用数据库默认模板: ${defaultTemplate.name} (ID: ${defaultTemplate.id})`);
      } else {
        // 没有默认模板时，使用固定文件模板（兜底）
        const templatePath = path.join(
          process.cwd(),
          'src',
          'templates',
          'wechat_article.html'
        );
        template = fs.readFileSync(templatePath, 'utf-8');
        templateSource = '固定文件模板';
        console.log('[MCP Tool] 使用固定文件模板');
      }
    } catch (error) {
      console.error('[MCP Tool] 获取默认模板失败，尝试读取固定文件:', error);
      
      // 异常情况下，尝试读取固定文件模板
      const templatePath = path.join(
        process.cwd(),
        'src',
        'templates',
        'wechat_article.html'
      );
      
      try {
        template = fs.readFileSync(templatePath, 'utf-8');
        templateSource = '固定文件模板（兜底）';
      } catch (fileError) {
        console.error('[MCP Tool] 读取模板文件失败:', fileError);
        return {
          success: false,
          error: '无法读取模板文件',
          metadata: { timestamp: Date.now() },
        };
      }
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

    // HTML 转义
    const escapeHtml = (text: string): string => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    // 替换模板变量
    const formattedHtml = template
      .replace(/\{\{title\}\}/g, escapeHtml(title))
      .replace(/\{\{author\}\}/g, escapeHtml(formattedAuthor))
      .replace(/\{\{date\}\}/g, escapeHtml(formattedDate))
      .replace(/\{\{content\}\}/g, formattedContent);

    const metadata = {
      title,
      author: formattedAuthor,
      date: formattedDate,
      originalLength: content.length,
      formattedLength: formattedHtml.length,
      templateSource,
    };

    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`[MCP Tool] wechatFormatArticle 执行完成，耗时 ${duration}ms，结果:`, { 
      success: true, 
      metadata 
    });
    
    return {
      success: true,
      data: {
        formattedHtml,
        metadata,
      },
      metadata: {
        accountId,
        timestamp: Date.now(),
      },
    };
  } catch (error: any) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.error(`[MCP Tool] wechatFormatArticle 执行失败，耗时 ${duration}ms，错误:`, error.message);
    
    return {
      success: false,
      error: `格式化文章失败: ${error.message}`,
      metadata: {
        timestamp: Date.now(),
      },
    };
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
 * 格式化行内元素（先处理加粗，再转义其他 HTML）
 */
function formatInlineWithBold(text: string): string {
  // 1. 先将【加粗】转换为 <strong> 标签
  let result = text.replace(/【([^】]+)】/g, '<strong>$1</strong>');
  
  // 2. 再转义其他 HTML 特殊字符（但保留我们刚加的 <strong> 标签）
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

/**
 * 微信公众号 MCP 工具集
 */
export const WechatMCPTools = {
  getAccounts: wechatGetAccounts,
  addDraft: wechatAddDraft,
  getDraftList: wechatGetDraftList,
  deleteDraft: wechatDeleteDraft,
  uploadMedia: wechatUploadMedia,
  formatArticle: wechatFormatArticle,
};

/**
 * 使用示例
 */
export async function exampleWechatUsage() {
  // 1. 获取账号列表
  const accountsResult = await wechatGetAccounts();
  if (accountsResult.success && accountsResult.data) {
    console.log('可用账号:', accountsResult.data);
  }

  // 2. 添加草稿
  const addDraftResult = await wechatAddDraft({
    accountId: 'insurance-account',
    articles: [
      {
        title: '测试文章标题',
        author: '保险科普',
        digest: '这是文章摘要',
        content: '<p>这是文章内容</p>',
        show_cover_pic: 0,
      },
    ],
  });
  console.log('添加草稿结果:', addDraftResult);

  // 3. 获取草稿列表
  const draftListResult = await wechatGetDraftList({
    accountId: 'insurance-account',
    offset: 0,
    count: 10,
  });
  console.log('草稿列表:', draftListResult);
}
