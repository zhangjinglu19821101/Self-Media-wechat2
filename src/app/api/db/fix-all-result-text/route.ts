/**
 * 批量修复 result_text 字段（全量版）
 * GET /api/db/fix-all-result-text
 * 
 * 设计原则：每个指令的 result_text 都应该是该指令的执行结果
 * 
 * 修复范围：
 * - 写作 Agent（insurance-d/xiaohongshu/zhihu/toutiao）: content/htmlContent/fullText
 * - Agent B（分析任务）: briefResponse/executionSummary.actionsTaken
 * - Agent T（合规校验）: output/suggestions
 * - 其他所有类型: 全路径提取 + 兜底序列化
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { isNull, or, sql, eq, and } from 'drizzle-orm';
import { extractResultTextFromResultData } from '@/lib/services/result-text-extractor';

export async function GET(request: NextRequest) {
  try {
    // 查找所有 result_text 为空或过短的已完成任务（不限 Agent 类型）
    const tasksNeedingFix = await db
      .select({
        id: agentSubTasks.id,
        taskTitle: agentSubTasks.taskTitle,
        executor: agentSubTasks.fromParentsExecutor,
        orderIndex: agentSubTasks.orderIndex,
        resultData: agentSubTasks.resultData,
      })
      .from(agentSubTasks)
      .where(
        and(
          sql`${agentSubTasks.status} = 'completed'`,
          or(
            isNull(agentSubTasks.resultText),
            sql`LENGTH(COALESCE(${agentSubTasks.resultText}, '')) < 10`
          ),
          sql`${agentSubTasks.resultData} IS NOT NULL`
        )
      );

    let fixedCount = 0;
    const errors: string[] = [];
    const fixedTasks: { id: string; executor: string | null; orderIndex: number | null; textLength: number }[] = [];

    for (const task of tasksNeedingFix) {
      try {
        // 🔴 使用共享服务提取 result_text（传入 executor 做平台优先提取）
        const extractedText = extractResultTextFromResultData(task.resultData, { executor: task.executor || undefined });

        if (extractedText && extractedText.trim().length > 5) {
          await db
            .update(agentSubTasks)
            .set({
              resultText: extractedText,
              updatedAt: new Date(),
            })
            .where(eq(agentSubTasks.id, task.id));
          fixedCount++;
          fixedTasks.push({
            id: task.id,
            executor: task.executor,
            orderIndex: task.orderIndex,
            textLength: extractedText.length,
          });
        }
      } catch (err) {
        errors.push(`任务 ${task.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      success: true,
      total: tasksNeedingFix.length,
      fixed: fixedCount,
      fixedTasks: fixedTasks.length <= 50 ? fixedTasks : `${fixedTasks.length} tasks fixed (details omitted)`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[Fix Result Text] 失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
