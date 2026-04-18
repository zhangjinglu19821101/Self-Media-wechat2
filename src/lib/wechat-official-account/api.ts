/**
 * 微信公众号 API 封装
 * 提供草稿箱操作功能
 */

import {
  WechatOfficialAccount,
  WechatDraft,
  WechatDraftResponse,
  WECHAT_API_CONFIG,
  getDraftDefaults,  // 🔥 新增
} from '@/config/wechat-official-account.config';

/**
 * Access Token 缓存
 */
interface AccessTokenCache {
  token: string;
  expiresAt: number;
}

const tokenCache = new Map<string, AccessTokenCache>();

/**
 * 获取 Access Token
 */
export async function getAccessToken(account: WechatOfficialAccount): Promise<string> {
  const cacheKey = account.id;

  // 检查缓存
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  // 请求新的 Access Token
  const url = `${WECHAT_API_CONFIG.baseUrl}/token?grant_type=client_credential&appid=${account.appId}&secret=${account.appSecret}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(WECHAT_API_CONFIG.apiTimeout),
    });

    const data = await response.json();

    if (data.errcode) {
      throw new Error(`获取 Access Token 失败: ${data.errmsg}`);
    }

    const token = data.access_token;
    const expiresIn = data.expires_in || WECHAT_API_CONFIG.tokenCacheTime;

    // 缓存 Token
    tokenCache.set(cacheKey, {
      token,
      expiresAt: Date.now() + (expiresIn - 300) * 1000, // 提前 5 分钟过期
    });

    return token;
  } catch (error: any) {
    throw new Error(`获取 Access Token 失败: ${error.message}`);
  }
}

/**
 * 上传永久缩略图（用于图文消息封面）
 * 微信公众号要求 thumb_media_id 必须是永久素材
 */
export async function uploadPermanentThumb(
  account: WechatOfficialAccount,
  file: File | Buffer
): Promise<{ mediaId: string; url: string }> {
  const token = await getAccessToken(account);
  const url = `${WECHAT_API_CONFIG.baseUrl}/material/add_material?access_token=${token}&type=thumb`;

  console.log('[微信公众号 API] 上传永久缩略图 URL:', url.replace(token, '***'));
  console.log('[微信公众号 API] 文件大小:', file instanceof Buffer ? file.length : file.size, 'bytes');

  try {
    const formData = new FormData();
    if (file instanceof File) {
      formData.append('media', file);
    } else {
      // 创建一个带正确 MIME 类型的 Blob
      const blob = new Blob([file], { type: 'image/png' });
      formData.append('media', blob, 'thumb.png');
    }

    console.log('[微信公众号 API] 开始上传永久缩略图...');
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(WECHAT_API_CONFIG.apiTimeout),
    });

    const data = await response.json();
    console.log('[微信公众号 API] 永久缩略图响应:', JSON.stringify(data));

    if (data.errcode) {
      throw new Error(`上传永久缩略图失败: ${data.errmsg}`);
    }

    return {
      mediaId: data.media_id,
      url: data.url,
    };
  } catch (error: any) {
    throw new Error(`上传永久缩略图失败: ${error.message}`);
  }
}

/**
 * 上传临时素材（图片）
 */
export async function uploadMedia(
  account: WechatOfficialAccount,
  mediaType: 'image',
  file: File | Buffer
): Promise<{ mediaId: string; url: string }> {
  const token = await getAccessToken(account);
  const url = `${WECHAT_API_CONFIG.baseUrl}/media/upload?access_token=${token}&type=${mediaType}`;

  console.log('[微信公众号 API] 上传素材 URL:', url.replace(token, '***'));
  console.log('[微信公众号 API] 文件大小:', file instanceof Buffer ? file.length : file.size, 'bytes');

  try {
    const formData = new FormData();
    if (file instanceof File) {
      formData.append('media', file);
    } else {
      // 创建一个带正确 MIME 类型的 Blob
      const blob = new Blob([file], { type: 'image/png' });
      formData.append('media', blob, 'image.png');
    }

    console.log('[微信公众号 API] 开始上传...');
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(WECHAT_API_CONFIG.apiTimeout),
    });

    const data = await response.json();
    console.log('[微信公众号 API] 响应:', JSON.stringify(data));

    if (data.errcode) {
      throw new Error(`上传素材失败: ${data.errmsg}`);
    }

    return {
      mediaId: data.media_id,
      url: data.url,
    };
  } catch (error: any) {
    throw new Error(`上传素材失败: ${error.message}`);
  }
}

/**
 * 添加草稿
 */
export async function addDraft(
  account: WechatOfficialAccount,
  articles: WechatDraft[]
): Promise<WechatDraftResponse> {
  const token = await getAccessToken(account);
  const url = `${WECHAT_API_CONFIG.baseUrl}/draft/add?access_token=${token}`;

  try {
    // 🔴 上传草稿单独设置更长的超时时间：2 分钟
    // 因为上传大文章需要更长时间
    const uploadTimeout = 120000;
    
    // 🔴 计算文章内容大小，用于调试
    const requestBody = JSON.stringify({ articles });
    const requestSizeKB = (requestBody.length / 1024).toFixed(2);
    console.log(`[微信公众号] 开始上传草稿，文章数量: ${articles.length}, 请求大小: ${requestSizeKB} KB`);
    console.log(`[微信公众号] 请求体预览:`, requestBody.substring(0, 500));
    
    // 记录开始时间
    const startTime = Date.now();
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody,
      signal: AbortSignal.timeout(uploadTimeout),
    });

    const data = await response.json();
    
    // 计算耗时
    const duration = Date.now() - startTime;
    console.log(`[微信公众号] 草稿上传完成，耗时: ${duration}ms, media_id: ${data.media_id}`);

    if (data.errcode) {
      throw new Error(`添加草稿失败: ${data.errmsg}`);
    }

    return {
      media_id: data.media_id,
      create_time: data.create_time,
    };
  } catch (error: any) {
    throw new Error(`添加草稿失败: ${error.message}`);
  }
}

/**
 * 获取草稿列表
 */
export async function getDraftList(
  account: WechatOfficialAccount,
  offset: number = 0,
  count: number = 20
): Promise<any> {
  const token = await getAccessToken(account);
  const url = `${WECHAT_API_CONFIG.baseUrl}/draft/batchget?access_token=${token}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        offset,
        count,
        no_content: 0,  // 0 表示返回内容
      }),
      signal: AbortSignal.timeout(WECHAT_API_CONFIG.apiTimeout),
    });

    const data = await response.json();

    if (data.errcode) {
      throw new Error(`获取草稿列表失败: ${data.errmsg}`);
    }

    return {
      total: data.total,
      item_count: data.item_count,
      items: data.item,
    };
  } catch (error: any) {
    throw new Error(`获取草稿列表失败: ${error.message}`);
  }
}

/**
 * 删除草稿
 */
export async function deleteDraft(
  account: WechatOfficialAccount,
  mediaId: string
): Promise<boolean> {
  const token = await getAccessToken(account);
  const url = `${WECHAT_API_CONFIG.baseUrl}/draft/delete?access_token=${token}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ media_id: mediaId }),
      signal: AbortSignal.timeout(WECHAT_API_CONFIG.apiTimeout),
    });

    const data = await response.json();

    if (data.errcode) {
      throw new Error(`删除草稿失败: ${data.errmsg}`);
    }

    return true;
  } catch (error: any) {
    throw new Error(`删除草稿失败: ${error.message}`);
  }
}

/**
 * 🔥 格式化文章内容为微信公众号格式（增强版，支持完整发布配置）
 * 注意：微信 API 使用下划线命名，不是驼峰命名
 */
export function formatArticleForWechat(
  title: string,
  content: string,
  author?: string,
  digest?: string,
  contentSourceUrl?: string,
  accountId?: string,  // 🔥 新增：公众号ID
  overrides?: Partial<WechatDraftDefaults>  // 🔥 新增：临时覆盖配置
): any {
  // 🔥 获取默认发布配置
  const defaults = getDraftDefaults(accountId);
  
  // 提取摘要（如果没有提供）
  const autoDigest = digest || (content ? content.slice(0, 120).replace(/<[^>]+>/g, '').trim() : '');

  // 注意：返回的对象使用微信 API 要求的下划线命名
  const article: any = {
    title,
    // 🔥 作者：优先使用传入值 → 覆盖值 → 默认配置 → '原创'
    author: author || overrides?.author || defaults.author || '原创',
    digest: autoDigest,
    content: formatContentForWechat(content),
    content_source_url: contentSourceUrl || '',
    
    // 🔥 原创声明：优先使用覆盖值 → 默认配置
    is_original: overrides?.isOriginal ?? defaults.isOriginal ?? 0,
    
    // 🔥 评论设置：优先使用覆盖值 → 默认配置
    need_open_comment: overrides?.needOpenComment ?? defaults.needOpenComment ?? 1,
    only_fans_can_comment: overrides?.onlyFansCanComment ?? defaults.onlyFansCanComment ?? 0,
    
    // 🔥 封面设置：优先使用覆盖值 → 默认配置
    show_cover_pic: overrides?.showCoverPic ?? defaults.showCoverPic ?? 0,
  };

  return article;
}

/**
 * @deprecated 请使用 formatArticleForWechat (增强版)
 * 格式化文章内容为微信公众号格式（旧版）
 */
export function formatArticleForWechatLegacy(
  title: string,
  content: string,
  author?: string,
  digest?: string,
  contentSourceUrl?: string
): any {
  return formatArticleForWechat(title, content, author, digest, contentSourceUrl);
}

/**
 * 格式化内容为微信公众号 HTML 格式
 */
function formatContentForWechat(content: string): string {
  // 如果内容为空，返回空字符串
  if (!content) {
    return '';
  }

  // 如果已经是 HTML，直接返回
  if (content.includes('<')) {
    return content;
  }

  // 将纯文本转换为简单的 HTML
  return content
    .split('\n\n')
    .map(paragraph => {
      if (paragraph.startsWith('# ')) {
        return `<h2 style="font-size: 18px; font-weight: bold; margin: 20px 0 10px;">${paragraph.slice(2)}</h2>`;
      } else if (paragraph.startsWith('## ')) {
        return `<h3 style="font-size: 16px; font-weight: bold; margin: 15px 0 8px;">${paragraph.slice(3)}</h3>`;
      } else {
        return `<section style="font-size: 14px; line-height: 1.8; margin-bottom: 15px; text-align: justify;">${paragraph}</section>`;
      }
    })
    .join('');
}

/**
 * 清除 Access Token 缓存
 */
export function clearAccessTokenCache(accountId?: string): void {
  if (accountId) {
    tokenCache.delete(accountId);
  } else {
    tokenCache.clear();
  }
}
