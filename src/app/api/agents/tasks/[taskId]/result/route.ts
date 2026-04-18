import { NextRequest, NextResponse } from 'next/server';
import { agentTask } from '@/lib/services/agent-task';

/**
 * PUT /api/agents/tasks/[taskId]/result
 * 提交任务结果（完成或失败）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    console.log('📥 [result] 收到任务结果提交:', { taskId });

    const body = await request.json();
    const { result, status } = body;
    console.log('📦 [result] 请求状态:', status);

    // 验证状态值
    if (status !== 'completed' && status !== 'failed') {
      console.log('❌ [result] 无效的状态值:', status);
      return NextResponse.json(
        {
          success: false,
          error: '状态只能是 completed 或 failed',
        },
        { status: 400 }
      );
    }

    if (!result) {
      console.log('❌ [result] 缺少任务结果');
      return NextResponse.json(
        {
          success: false,
          error: '缺少任务结果',
        },
        { status: 400 }
      );
    }

    let task;
    if (status === 'completed') {
      task = await agentTask.completeTask(taskId, result);
    } else {
      task = await agentTask.failTask(taskId, result);
    }

    if (!task) {
      console.log('❌ [result] 任务不存在:', taskId);
      return NextResponse.json(
        {
          success: false,
          error: '任务不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        task,
        message: status === 'completed' ? '任务已完成' : '任务已失败',
      },
    });
  } catch (error) {
    console.error('Error submitting task result:', error);
    return NextResponse.json(
      {
        success: false,
        error: '提交任务结果失败',
      },
      { status: 500 }
    );
  }
}
