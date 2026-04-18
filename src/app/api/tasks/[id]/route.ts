/**
 * Single Task API
 * 提供单个任务的查询、取消等接口
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { taskScheduler } from '@/lib/task-scheduler';
import { AgentTaskService } from '@/lib/services/agent-task';

/**
 * GET /api/tasks/:id - 获取指定任务
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { id: taskId } = await params;
    
    // 优先尝试从 taskScheduler 获取
    const task = taskScheduler.getTask(taskId);

    if (task) {
      return NextResponse.json({
        success: true,
        data: task,
      });
    }

    // 如果 taskScheduler 中没有，尝试从 AgentTaskService 获取
    const taskService = new AgentTaskService();
    const agentTask = await taskService.getTask(taskId);

    if (agentTask) {
      return NextResponse.json({
        success: true,
        data: {
          taskId: agentTask.taskId,
          taskName: agentTask.taskName,
          toAgentId: agentTask.toAgentId,
          fromAgentId: agentTask.fromAgentId,
          executor: agentTask.executor,
          taskStatus: agentTask.status,
          splitStatus: agentTask.splitStatus,
          metadata: agentTask.metadata || {},
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: `Task ${taskId} not found`,
      },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch task',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tasks/:id - 取消任务
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { id: taskId } = await params;
    const cancelled = taskScheduler.cancelTask(taskId);

    if (!cancelled) {
      return NextResponse.json(
        {
          success: false,
          error: `Task ${taskId} not found or cannot be cancelled`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Task cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling task:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to cancel task',
      },
      { status: 500 }
    );
  }
}
