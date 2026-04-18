/**
 * 调试 API：查看特定任务的状态
 *
 * GET /api/debug/task-status?taskId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');

  if (!taskId) {
    return NextResponse.json(
      { success: false, error: '缺少 taskId 参数' },
      { status: 400 }
    );
  }

  console.log('[Debug] ========== 查看任务状态 ==========');
  console.log('[Debug] taskId:', taskId);

  try {
    // 1. 查询任务
    const tasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, taskId));

    if (tasks.length === 0) {
      return NextResponse.json(
        { success: false, error: '找不到任务' },
        { status: 404 }
      );
    }

    const task = tasks[0];
    console.log('[Debug] 任务状态:', task.status);

    // 2. 查询历史记录
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

    console.log('[Debug] ========== 查询完成 ==========');

    return NextResponse.json({
      success: true,
      data: {
        task: {
          id: task.id,
          taskTitle: task.taskTitle,
          status: task.status,
          fromParentsExecutor: task.fromParentsExecutor,
          orderIndex: task.orderIndex,
          startedAt: task.startedAt?.toISOString(),
          updatedAt: task.updatedAt?.toISOString(),
          createdAt: task.createdAt?.toISOString(),
          executionResult: task.executionResult ? 
            (typeof task.executionResult === 'string' ? 
              task.executionResult : 
              JSON.stringify(task.executionResult)) : 
            null,
        },
        historyCount: historyRecords.length,
        historyRecords: historyRecords.map(record => ({
          id: record.id,
          interactType: record.interactType,
          interactUser: record.interactUser,
          interactTime: record.interactTime?.toISOString(),
          interactNum: record.interactNum,
        })),
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
