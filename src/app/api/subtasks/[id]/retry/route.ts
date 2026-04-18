import { NextRequest, NextResponse } from 'next/server';
import { TaskStateMachine } from '@/lib/services/task-state-machine';
import { requireAuth } from '@/lib/auth/context';

/**
 * 重试失败的子任务
 *
 * POST /api/subtasks/:id/retry
 *
 * 请求体：
 * {
 *   "reason": "重试原因（可选）",
 *   "retryedBy": "重试操作者（可选）"
 * }
 *
 * 功能：
 * 1. 验证子任务存在性
 * 2. 检查子任务状态是否可以重试（必须是 failed 或 blocked）
 * 3. 更新子任务状态为 'pending'，重置开始和完成时间
 * 4. 记录重试次数和重试原因
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id: subTaskId } = await params;
    const body = await request.json();
    const { reason = '用户重试', retryedBy = 'user' } = body;

    console.log(`🔄 重试子任务`);
    console.log(`  📍 子任务 ID: ${subTaskId}`);
    console.log(`  📋 重试原因: ${reason}`);

    // 调用状态机的重试方法
    const result = await TaskStateMachine.retrySubTask(
      subTaskId,
      reason,
      retryedBy
    );

    return NextResponse.json({
      success: true,
      message: '子任务已重试',
      data: result.subTask,
    }, { status: 200 });
  } catch (error: any) {
    console.error(`❌ 重试子任务失败:`, error);

    return NextResponse.json({
      success: false,
      error: error.message,
      message: error.message,
    }, { status: 400 });
  }
}
