/**
 * 修复 order_index 跳号问题
 * GET /api/db/fix-order-index-gaps
 * 
 * 解决大纲确认拆分导致的 order_index 跳号问题
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('[FixOrderIndex] 开始修复 order_index 跳号问题...');

    // 1. 查找所有 command_result_id 分组
    const groups = await db
      .select({ commandResultId: agentSubTasks.commandResultId })
      .from(agentSubTasks)
      .groupBy(agentSubTasks.commandResultId);

    console.log(`[FixOrderIndex] 找到 ${groups.length} 个任务组`);

    let fixedGroups = 0;
    let fixedTasks = 0;

    for (const group of groups) {
      const commandResultId = group.commandResultId;
      if (!commandResultId) continue;

      // 2. 获取该组的所有任务，按 order_index 排序
      const tasks = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.commandResultId, commandResultId))
        .orderBy(asc(agentSubTasks.orderIndex));

      // 3. 检查是否有跳号（排除 order_index >= 9000 的拆分标记任务）
      const normalTasks = tasks.filter(t => t.orderIndex < 9000);
      const orderIndexes = normalTasks.map(t => t.orderIndex);
      
      // 检查是否连续
      let hasGap = false;
      for (let i = 1; i < orderIndexes.length; i++) {
        if (orderIndexes[i] - orderIndexes[i - 1] > 1) {
          hasGap = true;
          console.log(`[FixOrderIndex] 发现跳号: ${commandResultId}, ${orderIndexes[i - 1]} -> ${orderIndexes[i]}`);
          break;
        }
      }

      if (!hasGap) continue;

      // 4. 修复跳号：重新分配连续的 order_index
      fixedGroups++;
      
      for (let i = 0; i < normalTasks.length; i++) {
        const task = normalTasks[i];
        const newOrderIndex = i + 1;
        
        if (task.orderIndex !== newOrderIndex) {
          const oldOrderIndex = task.orderIndex;
          
          // 更新 agent_sub_tasks
          await db
            .update(agentSubTasks)
            .set({ orderIndex: newOrderIndex })
            .where(eq(agentSubTasks.id, task.id));
          
          // 同步更新 step_history
          // 注意：此处更新可能影响同一 stepNo 的多条历史记录
          // TODO: P0 问题待优化 - step_history 应通过 taskId 关联而非 stepNo
          await db
            .update(agentSubTasksStepHistory)
            .set({ stepNo: newOrderIndex })
            .where(
              and(
                eq(agentSubTasksStepHistory.commandResultId, commandResultId),
                eq(agentSubTasksStepHistory.stepNo, oldOrderIndex)
              )
            );
          
          fixedTasks++;
          console.log(`[FixOrderIndex] 修复: ${task.taskTitle} ${oldOrderIndex} -> ${newOrderIndex}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `修复完成`,
      summary: {
        totalGroups: groups.length,
        fixedGroups,
        fixedTasks,
      }
    });

  } catch (error) {
    console.error('[FixOrderIndex] 修复失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}
