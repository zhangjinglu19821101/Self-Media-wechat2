/**
 * 调试 API：查看所有 in_progress 任务的详细信息
 *
 * GET /api/debug/in-progress-tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

export async function GET(request: NextRequest) {
  console.log('[Debug] ========== 查看 in_progress 任务详细信息 ==========');

  try {
    const now = getCurrentBeijingTime();

    // 1. 查询所有 in_progress 状态的任务
    const inProgressTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.status, 'in_progress'))
      .orderBy(desc(agentSubTasks.updatedAt));

    console.log('[Debug] 找到 in_progress 任务数:', inProgressTasks.length);

    // 2. 为每个任务查询详细的历史记录
    const tasksWithDetails = await Promise.all(
      inProgressTasks.map(async task => {
        // 查询历史记录
        const historyRecords = task.commandResultId ? await db
          .select()
          .from(agentSubTasksStepHistory)
          .where(
            and(
              eq(agentSubTasksStepHistory.commandResultId, task.commandResultId),
              eq(agentSubTasksStepHistory.stepNo, task.orderIndex)
            )
          )
          .orderBy(agentSubTasksStepHistory.interactTime)
          : [];

        // 计算已用时间
        const elapsed = task.startedAt 
          ? now.getTime() - task.startedAt.getTime()
          : 0;

        const elapsedMinutes = elapsed / 1000 / 60;

        return {
          // 任务基本信息
          id: task.id,
          taskTitle: task.taskTitle,
          taskDescription: task.taskDescription,
          status: task.status,
          fromParentsExecutor: task.fromParentsExecutor,
          orderIndex: task.orderIndex,
          commandResultId: task.commandResultId,
          
          // 时间信息
          startedAt: task.startedAt?.toISOString(),
          updatedAt: task.updatedAt?.toISOString(),
          createdAt: task.createdAt?.toISOString(),
          elapsedMs: elapsed,
          elapsedMinutes: elapsedMinutes.toFixed(2),
          
          // 执行信息
          executionResult: task.executionResult ? 
            (typeof task.executionResult === 'string' ? 
              task.executionResult.substring(0, 500) + '...' : 
              JSON.stringify(task.executionResult).substring(0, 500) + '...') : 
            null,
          statusProof: task.statusProof,
          
          // 元数据
          metadata: task.metadata,
          timeoutCount: (task.metadata as any)?.timeoutCount || 0,
          
          // 历史记录
          historyCount: historyRecords.length,
          historyRecords: historyRecords.map(record => ({
            id: record.id,
            interactType: record.interactType,
            interactUser: record.interactUser,
            interactTime: record.interactTime?.toISOString(),
            interactNum: record.interactNum,
            interactContent: record.interactContent ? 
              JSON.stringify(record.interactContent).substring(0, 300) + '...' : 
              null,
          })),
        };
      })
    );

    console.log('[Debug] ========== 查询完成 ==========');

    return NextResponse.json({
      success: true,
      data: {
        totalInProgress: inProgressTasks.length,
        tasks: tasksWithDetails,
        checkedAt: now.toISOString(),
      },
    });

  } catch (error) {
    console.error('[Debug] 查询失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    );
  }
}
