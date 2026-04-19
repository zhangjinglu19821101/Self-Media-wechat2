/**
 * 文章审核服务
 * 
 * 平台无关的文章审核流程管理
 * 支持：公众号、小红书、知乎等多平台
 * 
 * 核心设计理念：
 * - 审核流程本身是平台无关的
 * - 平台特定逻辑通过策略模式处理
 * - 利用现有表结构（step_history、mcp_executions、article_content）
 */

import { db } from '@/lib/db';
import { 
  articleContent, 
  agentSubTasks, 
  agentSubTasksStepHistory,
  agentSubTasksMcpExecutions
} from '@/lib/db/schema';
import { ArticleContentService } from './article-content-service';
import { eq, and, desc } from 'drizzle-orm';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

/**
 * 平台类型枚举
 */
export type PlatformType = 'wechat' | 'xiaohongshu' | 'zhihu' | 'generic';

/**
 * 审核结果类型
 */
export type ReviewResult = 'approved' | 'rejected' | 'needs_revision';

/**
 * 审核意见接口
 */
export interface ReviewComment {
  type: 'content' | 'compliance' | 'format' | 'platform_specific';
  location?: string;
  originalText?: string;
  suggestion: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * 审核结果接口
 */
export interface ReviewResultData {
  reviewId: string;
  platform: PlatformType;
  result: ReviewResult;
  comments: ReviewComment[];
  summary: string;
  reviewedAt: Date;
  reviewer: string; // 'auto' 或人工审核员ID
}

/**
 * 文章审核服务类
 */
export class ArticleReviewService {
  private static instance: ArticleReviewService;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): ArticleReviewService {
    if (!ArticleReviewService.instance) {
      ArticleReviewService.instance = new ArticleReviewService();
    }
    return ArticleReviewService.instance;
  }

  /**
   * 从子任务中提取平台类型
   */
  private extractPlatformFromTask(subTask: typeof agentSubTasks.$inferSelect): PlatformType {
    const title = subTask.taskTitle.toLowerCase();
    const description = subTask.taskDescription.toLowerCase();
    
    if (title.includes('公众号') || description.includes('公众号') || 
        title.includes('wechat') || description.includes('wechat')) {
      return 'wechat';
    }
    
    if (title.includes('小红书') || description.includes('小红书') ||
        title.includes('xiaohongshu') || description.includes('xiaohongshu')) {
      return 'xiaohongshu';
    }
    
    if (title.includes('知乎') || description.includes('知乎')) {
      return 'zhihu';
    }
    
    return 'generic';
  }

  /**
   * 从 MCP 执行记录中提取合规性校验结果
   */
  private async extractComplianceReviewFromMCP(
    subTask: typeof agentSubTasks.$inferSelect
  ): Promise<ReviewResultData | null> {
    try {
      // 查询该子任务的 MCP 执行记录（使用 commandResultId 和 orderIndex）
      // 注意：mcp_executions 表没有 subTaskId 字段，需要用 commandResultId + orderIndex 查询
      const mcpExecutions = await db
        .select()
        .from(agentSubTasksMcpExecutions)
        .where(and(
          eq(agentSubTasksMcpExecutions.commandResultId, subTask.commandResultId),
          eq(agentSubTasksMcpExecutions.orderIndex, subTask.orderIndex)
        ))
        .orderBy(desc(agentSubTasksMcpExecutions.attemptTimestamp))
        .limit(5);

      if (mcpExecutions.length === 0) {
        console.log('[ArticleReviewService] 没有找到 MCP 执行记录');
        return null;
      }

      // 查找合规性校验相关的 MCP 执行
      const complianceExecution = mcpExecutions.find(exec => {
        const toolName = exec.toolName?.toLowerCase() || '';
        const actionName = exec.actionName?.toLowerCase() || '';
        return toolName.includes('compliance') || 
               toolName.includes('audit') ||
               actionName.includes('compliance') ||
               actionName.includes('audit');
      });

      if (!complianceExecution) {
        console.log('[ArticleReviewService] 没有找到合规性校验 MCP 执行');
        return null;
      }

      // 解析 MCP 执行结果
      let reviewResult: ReviewResult = 'needs_revision';
      let comments: ReviewComment[] = [];
      let summary = '合规性校验完成';

      try {
        const result = complianceExecution.resultData;
        if (result) {
          const parsedResult = typeof result === 'string' 
            ? JSON.parse(result) 
            : result;

          // 根据 MCP 返回结果判断审核状态
          if (parsedResult.success || parsedResult.passed) {
            reviewResult = 'approved';
            summary = '合规性校验通过';
          } else if (parsedResult.needs_revision || parsedResult.needsRevision) {
            reviewResult = 'needs_revision';
            summary = '需要根据审核意见修改';
            
            // 提取具体的修改意见
            if (parsedResult.issues || parsedResult.comments || parsedResult.suggestions) {
              const issues = parsedResult.issues || parsedResult.comments || parsedResult.suggestions;
              comments = (Array.isArray(issues) ? issues : [issues]).map((issue: any) => ({
                type: issue.type || 'compliance',
                location: issue.location,
                originalText: issue.originalText,
                suggestion: issue.suggestion || issue.message || issue.description,
                severity: issue.severity || 'medium',
              }));
            }
          } else {
            reviewResult = 'rejected';
            summary = parsedResult.message || '审核未通过';
          }
        }
      } catch (parseError) {
        console.warn('[ArticleReviewService] 解析 MCP 结果失败:', parseError);
      }

      const platform = this.extractPlatformFromTask(subTask);

      return {
        reviewId: `review-${subTask.id}-${Date.now()}`,
        platform,
        result: reviewResult,
        comments,
        summary,
        reviewedAt: getCurrentBeijingTime(),
        reviewer: 'auto',
      };

    } catch (error) {
      console.error('[ArticleReviewService] 提取合规性审核结果失败:', error);
      return null;
    }
  }

  /**
   * 从步骤历史中提取人工审核意见
   */
  private async extractManualReviewFromHistory(
    subTask: typeof agentSubTasks.$inferSelect
  ): Promise<ReviewResultData | null> {
    try {
      // 查询该子任务的步骤历史
      const historyRecords = await db
        .select()
        .from(agentSubTasksStepHistory)
        .where(eq(agentSubTasksStepHistory.commandResultId, subTask.commandResultId))
        .orderBy(agentSubTasksStepHistory.stepNo, agentSubTasksStepHistory.interactNum);

      if (historyRecords.length === 0) {
        return null;
      }

      // 查找人工审核相关的交互
      let manualReviewData: ReviewResultData | null = null;
      const platform = this.extractPlatformFromTask(subTask);

      for (const record of historyRecords) {
        const content = record.interactContent as any;
        
        // 检查是否有人工审核的反馈
        if (record.interactUser === 'human' || record.interactType === 'response') {
          if (content?.user_decision || content?.review_result || content?.feedback) {
            // 提取人工审核结果
            const result = content.review_result || content.user_decision;
            let reviewResult: ReviewResult = 'needs_revision';
            
            if (result === 'approved' || result === 'pass' || result === '通过') {
              reviewResult = 'approved';
            } else if (result === 'rejected' || result === '拒绝') {
              reviewResult = 'rejected';
            }

            const comments: ReviewComment[] = [];
            if (content.comments || content.suggestions || content.feedback) {
              const feedbackList = content.comments || content.suggestions || 
                                   (content.feedback ? [content.feedback] : []);
              comments.push(...(Array.isArray(feedbackList) ? feedbackList : [feedbackList])
                .map((comment: any) => ({
                  type: typeof comment === 'string' ? 'content' : (comment.type || 'content'),
                  suggestion: typeof comment === 'string' ? comment : (comment.suggestion || comment.message),
                  severity: typeof comment === 'string' ? 'medium' : (comment.severity || 'medium'),
                })));
            }

            manualReviewData = {
              reviewId: `manual-review-${subTask.id}-${Date.now()}`,
              platform,
              result: reviewResult,
              comments,
              summary: content.summary || content.message || '人工审核完成',
              reviewedAt: record.interactTime ? new Date(record.interactTime) : getCurrentBeijingTime(),
              reviewer: 'human',
            };
            break;
          }
        }
      }

      return manualReviewData;

    } catch (error) {
      console.error('[ArticleReviewService] 提取人工审核意见失败:', error);
      return null;
    }
  }

  /**
   * 执行文章审核
   * 优先使用 MCP 合规性校验结果，如果没有则查找人工审核意见
   */
  public async executeReview(
    subTask: typeof agentSubTasks.$inferSelect
  ): Promise<ReviewResultData | null> {
    console.log('[ArticleReviewService] ========== 开始文章审核 ==========');
    console.log('[ArticleReviewService] 子任务信息:', {
      id: subTask.id,
      taskTitle: subTask.taskTitle,
      orderIndex: subTask.orderIndex,
      commandResultId: subTask.commandResultId,
      hasArticleMetadata: !!subTask.articleMetadata && Object.keys(subTask.articleMetadata).length > 0,
    });

    // 0. 🔴 关键：优先检查 article_metadata
    let articleInfo: { articleId?: string; articleTitle?: string } = {};
    
    if (subTask.articleMetadata && Object.keys(subTask.articleMetadata).length > 0) {
      console.log('[ArticleReviewService] ✅ 找到 article_metadata:', subTask.articleMetadata);
      
      // 从 article_metadata 中提取文章信息
      const metadata = subTask.articleMetadata as any;
      articleInfo.articleId = metadata.article_basic?.article_id;
      articleInfo.articleTitle = metadata.article_basic?.article_title;
    }

    // 1. 检查文章是否已经保存到 article_content 表
    const article = await db
      .select()
      .from(articleContent)
      .where(eq(articleContent.taskId, subTask.commandResultId))
      .limit(1);

    if (article.length === 0) {
      console.warn('[ArticleReviewService] ⚠️ ⚠️ ⚠️ 未找到文章内容！尝试触发保存...');
      
      // 尝试调用 ArticleContentService 保存文章
      try {
        const articleContentService = ArticleContentService.getInstance();
        const savedArticle = await articleContentService.saveArticleContent(subTask);
        
        if (savedArticle) {
          console.log('[ArticleReviewService] ✅ 文章保存成功:', savedArticle.articleId);
          articleInfo.articleId = savedArticle.articleId;
          articleInfo.articleTitle = savedArticle.articleTitle;
        } else {
          console.warn('[ArticleReviewService] ⚠️ 文章保存失败，无法继续审核');
          return null;
        }
      } catch (saveError) {
        console.error('[ArticleReviewService] ❌ 保存文章失败:', saveError);
        return null;
      }
    } else {
      console.log('[ArticleReviewService] ✅ 找到文章:', {
        articleId: article[0].articleId,
        articleTitle: article[0].articleTitle,
        contentStatus: article[0].contentStatus,
      });
      articleInfo.articleId = article[0].articleId;
      articleInfo.articleTitle = article[0].articleTitle;
    }

    // 1. 优先从 MCP 执行记录中提取合规性校验结果
    let reviewResult = await this.extractComplianceReviewFromMCP(subTask);
    
    // 2. 如果没有 MCP 结果，尝试从历史记录中提取人工审核意见
    if (!reviewResult) {
      console.log('[ArticleReviewService] 未找到 MCP 审核结果，尝试人工审核');
      reviewResult = await this.extractManualReviewFromHistory(subTask);
    }

    if (!reviewResult) {
      console.log('[ArticleReviewService] 未找到任何审核结果');
      return null;
    }

    console.log('[ArticleReviewService] 审核结果:', {
      platform: reviewResult.platform,
      result: reviewResult.result,
      commentsCount: reviewResult.comments.length,
      summary: reviewResult.summary,
    });

    // 3. 更新文章内容表的审核状态
    await this.updateArticleReviewStatus(subTask, reviewResult);

    console.log('[ArticleReviewService] ========== 审核完成 ==========');
    return reviewResult;
  }

  /**
   * 更新文章内容表的审核状态
   */
  private async updateArticleReviewStatus(
    subTask: typeof agentSubTasks.$inferSelect,
    reviewResult: ReviewResultData
  ): Promise<void> {
    try {
      // 查找关联的文章
      const articles = await db
        .select()
        .from(articleContent)
        .where(eq(articleContent.taskId, subTask.commandResultId))
        .limit(1);

      if (articles.length === 0) {
        console.log('[ArticleReviewService] 未找到关联的文章，跳过状态更新');
        return;
      }

      const article = articles[0];
      
      // 映射审核结果到文章状态
      let contentStatus: 'draft' | 'review' | 'published' | 'rejected' = 'review';
      if (reviewResult.result === 'approved') {
        contentStatus = 'review'; // 审核通过，等待发布
      } else if (reviewResult.result === 'rejected') {
        contentStatus = 'rejected';
      } else if (reviewResult.result === 'needs_revision') {
        contentStatus = 'draft'; // 需要修改，回到草稿状态
      }

      // 更新文章状态和审核信息
      await db
        .update(articleContent)
        .set({
          contentStatus,
          updateTime: getCurrentBeijingTime(),
          extInfo: {
            ...article.extInfo,
            lastReview: {
              reviewId: reviewResult.reviewId,
              platform: reviewResult.platform,
              result: reviewResult.result,
              comments: reviewResult.comments,
              summary: reviewResult.summary,
              reviewedAt: reviewResult.reviewedAt.toISOString(),
              reviewer: reviewResult.reviewer,
            },
          },
        })
        .where(eq(articleContent.articleId, article.articleId));

      console.log('[ArticleReviewService] 文章审核状态已更新:', {
        articleId: article.articleId,
        contentStatus,
      });

    } catch (error) {
      console.error('[ArticleReviewService] 更新文章审核状态失败:', error);
    }
  }

  /**
   * 获取文章的审核历史
   */
  public async getReviewHistory(articleId: string): Promise<ReviewResultData[]> {
    // 从 article_content.extInfo 中获取审核历史
    const articles = await db
      .select()
      .from(articleContent)
      .where(eq(articleContent.articleId, articleId))
      .limit(1);

    if (articles.length === 0) {
      return [];
    }

    const extInfo = articles[0].extInfo as any;
    const reviewHistory = extInfo?.reviewHistory || [];
    
    return Array.isArray(reviewHistory) ? reviewHistory : [];
  }
}
