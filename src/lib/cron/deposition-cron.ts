/**
 * 风格沉淀定时聚合任务 (Deposition Cron)
 *
 * Phase 4 定时任务 — 每日自动执行全量词频重算和规则权重调整
 *
 * 执行逻辑：
 * 1. 查询最近 50 篇已定稿文章（status=completed + executor=insurance-d）
 * 2. 调用 StyleDepositionService.extractHighFrequencyWords()
 * 3. 与现有 style_assets 记录合并且去重
 * 4. 更新权重（usageCount + 最近7天使用频率）
 * 5. 过期规则降权（validityExpiresAt < NOW() 的 isActive=false）
 *
 * 触发方式：
 * - API 手动触发: GET /api/cron/deposition/run
 * - 定时调度: 外部 cron 调用上述 API（如 AWS EventBridge / Vercel Cron）
 */

import { styleDepositionService } from '@/lib/services/style-deposition-service';
import type { DepositionSummary } from '@/lib/services/style-deposition-service';

/**
 * 执行风格沉淀聚合任务
 *
 * @param options - 聚合选项
 * @returns 执行摘要
 */
export async function runDepositionAggregation(options: {
  maxArticles?: number;
  userId?: string;
  expireDays?: number;
} = {}): Promise<DepositionSummary> {
  const startTime = Date.now();

  console.log('[DepositionCron] ========== 开始执行风格沉淀聚合任务 ==========');
  console.log('[DepositionCron] 配置:', JSON.stringify(options));

  try {
    const summary = await styleDepositionService.runFullAggregation(options);

    console.log('[DepositionCron] ========== 风格沉淀聚合完成 ==========', {
      processedArticles: summary.processedArticles,
      extractedWords: summary.extractedWords,
      newRulesCreated: summary.newRulesCreated,
      updatedRules: summary.updatedRules,
      errors: summary.errors.length,
      executionTimeMs: summary.executionTimeMs,
    });

    return summary;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[DepositionCron] ❌ 风格沉淀聚合失败:', errorMsg);

    return {
      processedArticles: 0,
      extractedWords: 0,
      newRulesCreated: 0,
      updatedRules: 0,
      errors: [errorMsg],
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * 快速检查是否有足够的文章值得运行聚合
 *
 * @returns 是否建议运行
 */
export async function shouldRunDeposition(): Promise<{
  shouldRun: boolean;
  completedArticleCount: number;
  reason: string;
}> {
  const { db } = await import('@/lib/db');
  const { agentSubTasks } = await import('@/lib/db/schema');
  const { eq, and, count: drizzleCount } = await import('drizzle-orm');

  try {
    const result = await db
      .select({ totalCount: drizzleCount() })
      .from(agentSubTasks)
      .where(
        and(
          eq(agentSubTasks.status, 'completed'),
          eq(agentSubTasks.fromParentsExecutor, 'insurance-d'),
        )
      );

    const articleCount = result[0]?.totalCount ?? 0;
    const shouldRun = articleCount >= 3; // 至少3篇文章才值得运行

    return {
      shouldRun,
      completedArticleCount: articleCount,
      reason: shouldRun
        ? `有 ${articleCount} 篇已完成文章，建议运行聚合`
        : `仅有 ${articleCount} 篇已完成文章，不足3篇，跳过聚合`,
    };

  } catch (error) {
    return {
      shouldRun: false,
      completedArticleCount: 0,
      reason: `查询失败: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
