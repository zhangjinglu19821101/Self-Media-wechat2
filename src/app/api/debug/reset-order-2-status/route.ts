import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * 重置 order_index=2 的状态
 * 从 waiting_user 或 pre_completed 重置为 pre_need_support
 * 这样下次轮询时会触发 Agent B 评审
 */
export async function POST(request: Request) {
  try {
    const { commandResultId, targetStatus } = await request.json();
    
    if (!commandResultId) {
      return NextResponse.json(
        { error: 'commandResultId is required' },
        { status: 400 }
      );
    }

    // 查找 order_index = 2 的任务
    const task = await db
      .select()
      .from(agentSubTasks)
      .where(
        eq(agentSubTasks.commandResultId, commandResultId)
      )
      .then(tasks => tasks.find(t => t.orderIndex === 2));

    if (!task) {
      return NextResponse.json(
        { error: 'Task with order_index=2 not found' },
        { status: 404 }
      );
    }

    console.log('[ResetOrder2Status] Current task status:', {
      orderIndex: task.orderIndex,
      status: task.status,
      taskTitle: task.taskTitle
    });

    // 定义哪些状态需要重置
    const statusesToReset = ['waiting_user', 'pre_completed'];
    const newStatus = targetStatus || 'pre_need_support';

    // 如果状态是需要重置的状态，重置为 pre_need_support
    if (statusesToReset.includes(task.status)) {
      await db
        .update(agentSubTasks)
        .set({
          status: newStatus,
          updatedAt: new Date()
        })
        .where(eq(agentSubTasks.id, task.id));

      console.log('[ResetOrder2Status] ✅ Status reset from', task.status, 'to', newStatus);

      return NextResponse.json({
        success: true,
        message: 'Status reset successfully',
        previousStatus: task.status,
        newStatus: newStatus
      });
    } else if (task.status === newStatus) {
      // 如果已经是目标状态，保持不变
      return NextResponse.json({
        success: true,
        message: 'Task is already in target status',
        currentStatus: task.status
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Task status is not in reset list',
        currentStatus: task.status,
        statusesThatCanBeReset: statusesToReset
      });
    }

  } catch (error) {
    console.error('[ResetOrder2Status] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
