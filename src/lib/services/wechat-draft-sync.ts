/**
 * 微信公众号草稿同步服务
 * 支持将微信公众号的草稿保存到本地数据库
 */

import { db, getDatabaseWithRetry } from '@/lib/db';
import { articleContent } from '@/lib/db/schema';
import { getDraftList } from '@/lib/wechat-official-account/api';
import { getAccountById } from '@/config/wechat-official-account.config';
import { eq } from 'drizzle-orm';

/**
 * 生成文章 ID
 */
function generateArticleId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ART${dateStr}${random}`;
}

/**
 * 从微信草稿中提取关键词
 */
function extractKeywords(title: string, content: string): string[] {
  const keywords: string[] = [];
  
  // 简单的关键词提取逻辑
  const commonKeywords = ['保险', '年金', '增额', '寿险', '重疾', '医疗', '意外', '理财', '投资', '养老', '教育', '健康'];
  
  for (const keyword of commonKeywords) {
    if (title.includes(keyword) || content.includes(keyword)) {
      keywords.push(keyword);
    }
  }
  
  return keywords.slice(0, 5); // 最多返回5个关键词
}

/**
 * 同步单个微信草稿到本地数据库
 */
export async function syncWechatDraftToLocal(
  wechatDraft: any,
  accountId: string,
  options?: {
    taskId?: string;
    creatorAgent?: string;
    overwrite?: boolean;
  }
): Promise<{ success: boolean; articleId?: string; error?: string }> {
  try {
    const { taskId = 'wechat-sync', creatorAgent = 'wechat-sync', overwrite = false } = options || {};
    
    // 获取草稿的第一篇文章
    const newsItem = wechatDraft.content?.news_item?.[0];
    if (!newsItem) {
      return { success: false, error: '草稿中没有文章内容' };
    }

    const database = await getDatabaseWithRetry();
    
    // 检查是否已存在相同的文章
    const existingArticles = await database
      .select()
      .from(articleContent)
      .where(eq(articleContent.articleTitle, newsItem.title || '微信导入文章'))
      .limit(1);

    if (existingArticles.length > 0 && !overwrite) {
      return { 
        success: false, 
        error: `文章已存在: ${newsItem.title || '无标题'}`,
        articleId: existingArticles[0].articleId
      };
    }

    const articleId = existingArticles.length > 0 ? existingArticles[0].articleId : generateArticleId();
    const now = new Date();

    // 提取关键词
    const keywords = extractKeywords(
      newsItem.title || '',
      newsItem.content || ''
    );

    // 准备文章数据
    const articleData = {
      articleId,
      taskId,
      creatorAgent,
      articleTitle: newsItem.title || '微信导入文章',
      articleSubtitle: newsItem.digest || '',
      articleContent: newsItem.content || '',
      coreKeywords: keywords,
      createTime: existingArticles.length > 0 ? existingArticles[0].createTime : now,
      updateTime: now,
      version: existingArticles.length > 0 ? (existingArticles[0].version || 1) + 1 : 1,
      contentStatus: 'draft' as const,
      rejectReason: '',
      wechatMpUrl: newsItem.url || '',
      wechatMpPublishTime: wechatDraft.update_time ? new Date(wechatDraft.update_time * 1000) : null,
      extInfo: {
        wechatMediaId: wechatDraft.media_id,
        wechatAccountId: accountId,
        thumbUrl: newsItem.thumb_url || '',
        thumbMediaId: newsItem.thumb_media_id || '',
        author: newsItem.author || '',
        showCoverPic: newsItem.show_cover_pic,
        needOpenComment: newsItem.need_open_comment,
        onlyFansCanComment: newsItem.only_fans_can_comment,
        articleType: newsItem.article_type,
        source: 'wechat-draft-sync',
        syncTime: now.toISOString(),
      },
    };

    if (existingArticles.length > 0) {
      // 更新现有文章
      await database
        .update(articleContent)
        .set(articleData)
        .where(eq(articleContent.articleId, articleId));
      
      console.log(`✅ 更新文章成功: ${articleId} - ${articleData.articleTitle}`);
    } else {
      // 插入新文章
      await database
        .insert(articleContent)
        .values(articleData);
      
      console.log(`✅ 保存新文章成功: ${articleId} - ${articleData.articleTitle}`);
    }

    return { success: true, articleId };

  } catch (error) {
    console.error('❌ 同步微信草稿失败:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    };
  }
}

/**
 * 批量同步微信草稿到本地数据库
 */
export async function syncWechatDraftsToLocal(
  accountId: string,
  options?: {
    offset?: number;
    count?: number;
    taskId?: string;
    creatorAgent?: string;
    overwrite?: boolean;
  }
): Promise<{
  success: boolean;
  total: number;
  synced: number;
  failed: number;
  results: Array<{ articleId?: string; title: string; success: boolean; error?: string }>;
  error?: string;
}> {
  try {
    const { offset = 0, count = 20, taskId, creatorAgent, overwrite = false } = options || {};
    
    console.log(`🔄 开始同步微信草稿，账号: ${accountId}, offset: ${offset}, count: ${count}`);

    // 获取账号
    const account = getAccountById(accountId);
    if (!account) {
      return {
        success: false,
        total: 0,
        synced: 0,
        failed: 0,
        results: [],
        error: `未找到账号: ${accountId}`,
      };
    }

    // 获取微信草稿列表
    const draftList = await getDraftList(account, offset, count);
    
    if (!draftList.items || draftList.items.length === 0) {
      return {
        success: true,
        total: 0,
        synced: 0,
        failed: 0,
        results: [],
        error: '没有可同步的草稿',
      };
    }

    console.log(`📋 获取到 ${draftList.items.length} 个草稿，开始同步...`);

    const results = [];
    let synced = 0;
    let failed = 0;

    // 逐个同步草稿
    for (const draft of draftList.items) {
      const newsItem = draft.content?.news_item?.[0];
      const title = newsItem?.title || '无标题文章';
      
      const result = await syncWechatDraftToLocal(draft, accountId, {
        taskId: taskId || `wechat-sync-${Date.now()}`,
        creatorAgent: creatorAgent || 'wechat-sync',
        overwrite,
      });

      results.push({
        articleId: result.articleId,
        title,
        success: result.success,
        error: result.error,
      });

      if (result.success) {
        synced++;
      } else {
        failed++;
      }
    }

    console.log(`✅ 同步完成: 总计 ${draftList.items.length}, 成功 ${synced}, 失败 ${failed}`);

    return {
      success: true,
      total: draftList.items.length,
      synced,
      failed,
      results,
    };

  } catch (error) {
    console.error('❌ 批量同步微信草稿失败:', error);
    return {
      success: false,
      total: 0,
      synced: 0,
      failed: 0,
      results: [],
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

/**
 * 随机获取一个微信草稿并同步到本地
 */
export async function syncRandomWechatDraft(
  accountId: string,
  options?: {
    taskId?: string;
    creatorAgent?: string;
    overwrite?: boolean;
  }
): Promise<{
  success: boolean;
  articleId?: string;
  draft?: any;
  error?: string;
}> {
  try {
    console.log(`🎲 随机获取一个微信草稿，账号: ${accountId}`);

    // 获取账号
    const account = getAccountById(accountId);
    if (!account) {
      return {
        success: false,
        error: `未找到账号: ${accountId}`,
      };
    }

    // 获取所有草稿（最多100个）
    const draftList = await getDraftList(account, 0, 100);
    
    if (!draftList.items || draftList.items.length === 0) {
      return {
        success: false,
        error: '没有可同步的草稿',
      };
    }

    console.log(`📋 共有 ${draftList.items.length} 个草稿可供选择`);

    // 随机选择一个草稿
    const randomIndex = Math.floor(Math.random() * draftList.items.length);
    const randomDraft = draftList.items[randomIndex];
    
    const newsItem = randomDraft.content?.news_item?.[0];
    const title = newsItem?.title || '无标题文章';
    
    console.log(`🎯 选中草稿 #${randomIndex + 1}: ${title}`);

    // 同步这个草稿到本地
    const result = await syncWechatDraftToLocal(randomDraft, accountId, {
      taskId: options?.taskId || `random-sync-${Date.now()}`,
      creatorAgent: options?.creatorAgent || 'random-sync',
      overwrite: options?.overwrite,
    });

    return {
      ...result,
      draft: {
        mediaId: randomDraft.media_id,
        title,
        index: randomIndex,
        total: draftList.items.length,
      },
    };

  } catch (error) {
    console.error('❌ 随机获取微信草稿失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
  }
}

/**
 * 获取本地已同步的微信草稿列表
 */
export async function getLocalWechatDrafts(
  options?: {
    limit?: number;
    offset?: number;
    status?: string;
  }
) {
  try {
    const { limit = 20, offset = 0, status } = options || {};
    const database = await getDatabaseWithRetry();

    let query = database
      .select()
      .from(articleContent)
      .orderBy(articleContent.createTime);

    if (status) {
      query = query.where(eq(articleContent.contentStatus, status));
    }

    const articles = await query.limit(limit).offset(offset);

    return {
      success: true,
      data: articles,
      total: articles.length,
    };
  } catch (error) {
    console.error('❌ 获取本地草稿失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      data: [],
      total: 0,
    };
  }
}
