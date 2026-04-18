import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, dailyTask } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { TaskStateMachine } from '@/lib/services/task-state-machine';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';
import { requireAuth } from '@/lib/auth/context';

/**
 * 更新子任务状态
 *
 * PUT /api/subtasks/:id/status
 *
 * 请求体：
 * {
 *   "status": "in_progress | completed | failed",
 *   "statusProof": "状态更新佐证（可选）",
 *   "executionResult": "执行结果描述（可选）"
 * }
 *
 * 功能：
 * 1. 验证子任务存在性
 * 2. 验证状态合法性（pending → in_progress → completed/failed）
 * 3. 更新子任务状态和相关字段
 * 4. 🔥 触发失败状态级联检查（如果状态为 failed）
 * 5. 更新父任务的子任务进展统计
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id: subTaskId } = await params;
    const body = await request.json();
    const { status, statusProof, executionResult } = body;

    console.log(`🔄 更新子任务状态`);
    console.log(`📍 子任务 ID: ${subTaskId}`);
    console.log(`📋 新状态: ${status}`);

    // 1. 验证状态合法性
    const validStatuses = ['pending', 'in_progress', 'completed', 'failed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({
        success: false,
        error: '无效的状态值',
        message: `状态必须是以下值之一：${validStatuses.join(', ')}`,
      }, { status: 400 });
    }

    // 2. 查询子任务
    const subTasks = await db.select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, subTaskId));

    if (subTasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: '子任务不存在',
        message: `子任务 ID ${subTaskId} 不存在`,
      }, { status: 404 });
    }

    const subTask = subTasks[0];

    // 3. 验证状态流转合法性
    const currentStatus = subTask.status;
    const allowedTransitions = {
      pending: ['in_progress', 'failed'],
      in_progress: ['completed', 'failed'],
      completed: [],
      failed: [],
    };

    if (!allowedTransitions[currentStatus].includes(status)) {
      return NextResponse.json({
        success: false,
        error: '非法的状态流转',
        message: `无法从 ${currentStatus} 转换到 ${status}`,
      }, { status: 400 });
    }

    console.log(`✅ 状态流转合法: ${currentStatus} → ${status}`);

    // 4. 更新子任务状态
    const updateData: any = {
      status,
      updatedAt: getCurrentBeijingTime(),
    };

    if (statusProof) {
      updateData.statusProof = statusProof;
    }

    if (executionResult) {
      updateData.executionResult = executionResult;
    }

    // 更新时间戳
    if (status === 'in_progress' && !subTask.startedAt) {
      updateData.startedAt = getCurrentBeijingTime();
    }

    if (status === 'completed' || status === 'failed') {
      updateData.completedAt = getCurrentBeijingTime();
    }

    await db.update(agentSubTasks)
      .set(updateData)
      .where(eq(agentSubTasks.id, subTaskId));

    console.log(`✅ 子任务状态已更新`);

    // 5. 🔥 检查是否为关键子任务失败
    if (status === 'failed' && subTask.metadata?.isCritical) {
      console.log(`🔥 关键子任务失败，触发级联更新`);

      // 调用级联失败处理
      try {
        await TaskStateMachine.handleCriticalSubTaskFailure(
          subTask.commandResultId,
          subTask.taskTitle,
          statusProof || executionResult || '子任务失败',
          'subtask_failure'
        );
      } catch (cascadeError) {
        console.error(`❌ 级联更新失败:`, cascadeError);
        // 即使级联失败，子任务状态已经更新，不抛出错误
      }
    }

    // 6. 更新父任务的子任务进展统计
    const dailyTaskList = await db.select()
      .from(dailyTask)
      .where(eq(dailyTask.id, subTask.commandResultId));

    if (dailyTaskList.length > 0) {
      const commandResult = dailyTaskList[0];

      // 查询该指令的所有子任务
      const allSubTasks = await db.select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.commandResultId, subTask.commandResultId));

      const completedCount = allSubTasks.filter(st => st.status === 'completed').length;
      const failedCount = allSubTasks.filter(st => st.status === 'failed').length;
      const lastCompletedTask = allSubTasks
        .filter(st => st.status === 'completed')
        .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))[0];

      await db.update(dailyTask)
        .set({
          completedSubTasks: completedCount,
          completedSubTasksDescription: lastCompletedTask?.taskTitle || '',
          ...(failedCount > 0 ? { questionStatus: 'pending' } : {}),
        })
        .where(eq(dailyTask.id, subTask.commandResultId));

      console.log(`✅ 父任务进展已更新: ${completedCount}/${allSubTasks.length} 已完成`);
    }

    return NextResponse.json({
      success: true,
      message: '子任务状态已更新',
      data: {
        id: subTaskId,
        status,
        updatedAt: getCurrentBeijingTime().toISOString(),
      },
    });
  } catch (error) {
    console.error('❌ 更新子任务状态失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

/**
 * 获取子任务详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: subTaskId } = await params;

    console.log(`🔍 查询子任务详情`);
    console.log(`📍 子任务 ID: ${subTaskId}`);

    const subTasks = await db.select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, subTaskId));

    if (subTasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: '子任务不存在',
        message: `子任务 ID ${subTaskId} 不存在`,
      }, { status: 404 });
    }

    const subTask = subTasks[0];

    return NextResponse.json({
      success: true,
      data: {
        ...subTask,
        metadata: {
          ...subTask.metadata,
          isCritical: subTask.metadata?.isCritical || false,
          criticalReason: subTask.metadata?.criticalReason || '',
        },
      },
    });
  } catch (error) {
    console.error('❌ 查询子任务详情失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
