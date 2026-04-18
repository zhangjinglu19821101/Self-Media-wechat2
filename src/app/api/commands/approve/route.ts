import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask, agentTasks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { TaskManager } from '@/lib/services/task-manager';

/**
 * POST /api/commands/approve - Agent A 确认拆解
 *
 * 请求体：
 * {
 *   agentId: "agent A",
 *   taskId: "task-001",
 *   commandIds: ["cmd-task-20260222-001-01", "cmd-task-20260222-001-02"] // 可选：指定确认的子任务，全部确认则不传
 * }
 *
 * 响应：
 * {
 *   success: true,
 *   message: "任务拆解已确认",
 *   data: { confirmedCount: 2 }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, taskId, commandIds } = body;

    if (!agentId || !taskId) {
      return NextResponse.json(
        { success: false, error: '缺少必填参数：agentId, taskId' },
        { status: 400 }
      );
    }

    // 1. 验证总任务是否存在且属于该 Agent A
    const task = await TaskManager.getTask(taskId);
    if (!task) {
      return NextResponse.json(
        { success: false, error: '任务不存在' },
        { status: 404 }
      );
    }

    if (task.fromAgentId !== agentId) {
      return NextResponse.json(
        { success: false, error: '无权确认此任务' },
        { status: 403 }
      );
    }

    if (task.splitStatus !== 'split_pending_review') {
      return NextResponse.json(
        { success: false, error: '任务状态不允许确认' },
        { status: 400 }
      );
    }

    // 2. 更新子任务确认状态
    let confirmedCount = 0;

    if (commandIds && Array.isArray(commandIds) && commandIds.length > 0) {
      // 确认指定的子任务
      for (const commandId of commandIds) {
        await db
          .update(dailyTask)
          .set({
            executionStatus: 'confirmed', // 改为 confirmed 状态
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(dailyTask.commandId, commandId),
              eq(dailyTask.relatedTaskId, taskId)
            )
          );
        confirmedCount++;
      }

      // 检查是否所有子任务都已确认
      const allSubTasks = await db
        .select()
        .from(dailyTask)
        .where(eq(dailyTask.relatedTaskId, taskId));

      const allConfirmed = allSubTasks.every((st) => st.executionStatus === 'confirmed');
      if (allConfirmed) {
        await TaskManager.updateTaskSplitStatus(taskId, 'split_confirmed');
      }
    } else {
      // 确认所有子任务
      const allSubTasks = await db
        .select()
        .from(dailyTask)
        .where(eq(dailyTask.relatedTaskId, taskId));

      for (const subTask of allSubTasks) {
        await db
          .update(dailyTask)
          .set({
            executionStatus: 'confirmed', // 改为 confirmed 状态
            updatedAt: new Date(),
          })
          .where(eq(dailyTask.commandId, subTask.commandId));
        confirmedCount++;
      }

      // 更新总任务状态
      await TaskManager.updateTaskSplitStatus(taskId, 'split_confirmed');
    }

    console.log(`✅ 任务拆解已确认: taskId=${taskId}, confirmedCount=${confirmedCount}, by=${agentId}`);

    return NextResponse.json({
      success: true,
      message: '任务拆解已确认',
      data: {
        taskId,
        confirmedCount,
      },
    });
  } catch (error: any) {
    console.error('❌ 确认拆解失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '确认失败' },
      { status: 500 }
    );
  }
}
