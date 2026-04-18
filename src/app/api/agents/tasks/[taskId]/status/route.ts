import { NextRequest, NextResponse } from 'next/server';
import { agentTask } from '@/lib/services/agent-task';

/**
 * PUT /api/agents/tasks/[taskId]/status
 * 更新任务状态
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    console.log('🔄 [status] 更新任务状态:', { taskId });

    const body = await request.json();
    const { status } = body;
    console.log('🔄 [status] 请求状态:', status);

    // 验证状态值
    const validStatuses = ['pending', 'in_progress', 'completed', 'failed'];
    if (!validStatuses.includes(status)) {
      console.log('❌ [status] 无效的状态值:', status);
      return NextResponse.json(
        {
          success: false,
          error: '无效的状态值',
        },
        { status: 400 }
      );
    }

    let task;
    if (status === 'in_progress') {
      console.log('✅ [status] 调用 startTask:', taskId);
      task = await agentTask.startTask(taskId);
      console.log('✅ [status] startTask 结果:', task);
    } else if (status === 'completed' || status === 'failed') {
      return NextResponse.json(
        {
          success: false,
          error: '完成/失败状态需要通过 /result 接口提交结果',
        },
        { status: 400 }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          error: '不支持的状态变更',
        },
        { status: 400 }
      );
    }

    if (!task) {
      console.log('❌ [status] 任务不存在:', taskId);
      return NextResponse.json(
        {
          success: false,
          error: '任务不存在',
        },
        { status: 404 }
      );
    }

    console.log('✅ [status] 任务状态更新成功:', task.status);
    return NextResponse.json({
      success: true,
      data: {
        task,
        message: `任务状态已更新为: ${status}`,
      },
    });
  } catch (error) {
    console.error('❌ [status] Error updating task status:', error);
    return NextResponse.json(
      {
        success: false,
        error: '更新任务状态失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
