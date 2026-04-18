import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq, and, isNotNull, isNull } from 'drizzle-orm';

/**
 * 修复大纲确认双子任务的结构信息
 * 问题：order_index=2/3 的子任务没有继承原任务的 structureName 和 structureDetail
 * 解决：从同组 order_index=1 的任务中复制结构信息
 */
export async function GET() {
  try {
    // 1. 查找所有有结构信息的任务（order_index=1）
    const tasksWithStructure = await db
      .select({
        commandResultId: agentSubTasks.commandResultId,
        structureName: agentSubTasks.structureName,
        structureDetail: agentSubTasks.structureDetail,
      })
      .from(agentSubTasks)
      .where(
        and(
          eq(agentSubTasks.orderIndex, 1),
          isNotNull(agentSubTasks.structureName)
        )
      );

    console.log(`[修复结构信息] 找到 ${tasksWithStructure.length} 个有结构信息的任务组`);

    let fixedCount = 0;

    // 2. 对每个任务组，修复 order_index=2 和 order_index=3 的结构信息
    for (const task of tasksWithStructure) {
      // 修复 order_index=2
      const result2 = await db
        .update(agentSubTasks)
        .set({
          structureName: task.structureName,
          structureDetail: task.structureDetail,
        })
        .where(
          and(
            eq(agentSubTasks.commandResultId, task.commandResultId),
            eq(agentSubTasks.orderIndex, 2),
            isNull(agentSubTasks.structureName)
          )
        );

      // 修复 order_index=3
      const result3 = await db
        .update(agentSubTasks)
        .set({
          structureName: task.structureName,
          structureDetail: task.structureDetail,
        })
        .where(
          and(
            eq(agentSubTasks.commandResultId, task.commandResultId),
            eq(agentSubTasks.orderIndex, 3),
            isNull(agentSubTasks.structureName)
          )
        );

      if (result2.rowCount && result2.rowCount > 0) {
        fixedCount += result2.rowCount;
        console.log(`[修复结构信息] 修复 order_index=2: ${task.commandResultId}`);
      }
      if (result3.rowCount && result3.rowCount > 0) {
        fixedCount += result3.rowCount;
        console.log(`[修复结构信息] 修复 order_index=3: ${task.commandResultId}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `修复完成，共更新 ${fixedCount} 条记录`,
      details: {
        taskGroupsWithStructure: tasksWithStructure.length,
        fixedRecords: fixedCount,
      },
    });
  } catch (error) {
    console.error('[修复结构信息] 失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
