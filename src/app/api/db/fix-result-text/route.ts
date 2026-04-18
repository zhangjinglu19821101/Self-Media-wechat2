import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * 修复 agent_sub_tasks.result_text 字段
 * 从 result_data.executorOutput.structuredResult.resultContent 中提取 content 写入 result_text
 * 
 * GET /api/db/fix-result-text
 */
export async function GET() {
  try {
    // 1. 查询所有 result_text 为空或过短的写作任务
    // 使用 coalesce 处理 NULL 和空字符串
    const tasksToUpdate = await db.execute(sql`
      SELECT id, order_index, task_title, result_data::text, result_text
      FROM agent_sub_tasks
      WHERE coalesce(result_text, '') = '' OR length(result_text) < 50
      AND result_data IS NOT NULL
      AND from_parents_executor IN ('insurance-d', 'insurance-xiaohongshu', 'insurance-zhihu', 'insurance-toutiao')
      AND status = 'completed'
      LIMIT 100
    `);

    const rows = tasksToUpdate.rows || [];
    console.log('[FixResultText] 找到需要修复的任务数量:', rows.length);

    let fixedCount = 0;
    let failedCount = 0;

    for (const task of rows) {
      try {
        const taskId = task.id as string;
        const resultDataText = task.result_data as string;
        
        if (!resultDataText) continue;
        
        const resultData = JSON.parse(resultDataText);
        
        // 尝试从多种路径提取内容
        let extractedText = '';
        
        // 路径1: executorOutput.structuredResult.resultContent (JSON string)
        const resultContent = resultData?.executorOutput?.structuredResult?.resultContent;
        if (resultContent) {
          if (typeof resultContent === 'string') {
            try {
              const parsed = JSON.parse(resultContent);
              if (parsed?.content && typeof parsed.content === 'string' && parsed.content.trim().length > 0) {
                extractedText = parsed.content;
              }
            } catch {
              // 不是 JSON，可能是纯文本
              if (typeof resultContent === 'string' && resultContent.length > 100) {
                extractedText = resultContent;
              }
            }
          } else if (typeof resultContent === 'object' && resultContent !== null && resultContent.content) {
            extractedText = resultContent.content;
          }
        }
        
        // 路径2: executorOutput.result.content
        if (!extractedText && resultData?.executorOutput?.result?.content) {
          extractedText = resultData.executorOutput.result.content;
        }
        
        // 路径3: result.content
        if (!extractedText && resultData?.result?.content) {
          extractedText = resultData.result.content;
        }
        
        if (extractedText && typeof extractedText === 'string' && extractedText.trim().length > 50) {
          await db.update(agentSubTasks)
            .set({ resultText: extractedText })
            .where(eq(agentSubTasks.id, taskId));
          
          fixedCount++;
          console.log(`[FixResultText] 修复任务 ${taskId} (order_index=${task.order_index}): ${extractedText.length} 字符`);
        } else {
          failedCount++;
          console.log(`[FixResultText] 无法从任务 ${taskId} 提取内容`);
        }
      } catch (err) {
        failedCount++;
        console.error('[FixResultText] 处理任务失败:', err);
      }
    }

    return NextResponse.json({
      success: true,
      message: `修复完成：成功 ${fixedCount} 个，失败 ${failedCount} 个`,
      total: rows.length,
      fixed: fixedCount,
      failed: failedCount
    });

  } catch (error) {
    console.error('[FixResultText] 执行失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
