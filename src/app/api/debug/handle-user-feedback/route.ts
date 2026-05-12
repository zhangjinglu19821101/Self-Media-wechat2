/**
 * 调试 API：手动处理用户反馈，让任务继续执行
 *
 * POST /api/debug/handle-user-feedback
 * Body: { taskId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { SubtaskExecutionEngine } from '@/lib/services/subtask-execution-engine';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

export async function POST(request: NextRequest) {
  console.log('[Debug] ========== 手动处理用户反馈 ==========');

  try {
    const body = await request.json();
    const { taskId } = body;

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: '缺少 taskId 参数' },
        { status: 400 }
      );
    }

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
    console.log('[Debug] 找到任务:', task.id, task.taskTitle);

    // 2. 查询最新的历史记录
    if (!task.commandResultId) {
      return NextResponse.json(
        { success: false, error: '任务没有 commandResultId' },
        { status: 400 }
      );
    }

    const historyRecords = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, task.commandResultId),
          eq(agentSubTasksStepHistory.stepNo, task.orderIndex)
        )
      )
      .orderBy(desc(agentSubTasksStepHistory.interactTime));

    if (historyRecords.length === 0) {
      return NextResponse.json(
        { success: false, error: '找不到历史记录' },
        { status: 400 }
      );
    }

    const latestHistory = historyRecords[0];
    console.log('[Debug] 最新历史记录:', latestHistory.interactType, latestHistory.interactUser);

    // 3. 检查是否是用户反馈
    if (latestHistory.interactType !== 'response' || latestHistory.interactUser !== 'human') {
      return NextResponse.json(
        { success: false, error: '最新记录不是用户反馈' },
        { status: 400 }
      );
    }

    // 4. 检查任务状态是否是 in_progress
    if (task.status !== 'in_progress') {
      return NextResponse.json(
        { success: false, error: '任务状态不是 in_progress' },
        { status: 400 }
      );
    }

    // 5. 解析用户反馈内容
    let userDecision;
    try {
      const content = latestHistory.interactContent as any;
      if (typeof content === 'string') {
        userDecision = JSON.parse(content);
      } else {
        userDecision = content;
      }
    } catch (e) {
      return NextResponse.json(
        { success: false, error: '无法解析用户反馈内容' },
        { status: 400 }
      );
    }

    console.log('[Debug] 用户决策:', userDecision);

    // 6. 调用执行引擎继续执行
    console.log('[Debug] 调用执行引擎继续执行...');
    const engine = new SubtaskExecutionEngine();
    await engine.execute();

    console.log('[Debug] ========== 处理完成 ==========');

    // 7. 查询更新后的任务状态
    const updatedTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, taskId));

    return NextResponse.json({
      success: true,
      data: {
        taskId: task.id,
        taskTitle: task.taskTitle,
        userDecision: userDecision,
        newStatus: updatedTasks[0]?.status,
        message: '已触发任务继续执行',
      },
    });

  } catch (error) {
    console.error('[Debug] 处理失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '处理失败' },
      { status: 500 }
    );
  }
}
