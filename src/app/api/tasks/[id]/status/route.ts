import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { TaskManager } from '@/lib/services/task-manager';

/**
 * POST /api/tasks/[id]/status
 * 更新任务状态
 *
 * 允许 Agent 更新任务状态（开始执行、完成、失败等）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('📥 === /api/tasks/[id]/status 收到任务状态更新请求 ===');

  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id: taskId } = await params;
    const body = await request.json();
    const { status, result } = body;

    console.log('📦 请求参数:');
    console.log('  - taskId:', taskId);
    console.log('  - status:', status);
    console.log('  - result:', result?.substring(0, 200) || '无');

    // 验证状态值
    const validStatuses = ['pending', 'in_progress', 'completed', 'failed'];
    if (!validStatuses.includes(status)) {
      console.log('❌ 参数验证失败: 无效的状态值');
      return NextResponse.json(
        {
          success: false,
          error: `无效的状态值，必须是: ${validStatuses.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // 更新任务状态
    const task = await TaskManager.updateTaskStatus(
      taskId,
      status,
      result
    );

    if (!task) {
      console.log('❌ 任务不存在');
      return NextResponse.json(
        {
          success: false,
          error: '任务不存在',
        },
        { status: 404 }
      );
    }

    console.log(`✅ 任务状态已更新: taskId=${taskId}, status=${status}`);

    return NextResponse.json(
      {
        success: true,
        message: '任务状态已更新',
        data: task,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating task status:', error);

    return NextResponse.json(
      {
        success: false,
        error: '更新任务状态失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
