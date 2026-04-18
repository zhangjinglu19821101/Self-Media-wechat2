import { NextRequest, NextResponse } from 'next/server';
import { TaskStateMachine } from '@/lib/services/task-state-machine';
import { requireAuth } from '@/lib/auth/context';

/**
 * 跳过非关键子任务
 *
 * POST /api/subtasks/:id/skip
 *
 * 请求体：
 * {
 *   "reason": "跳过原因（可选）",
 *   "skippedBy": "跳过操作者（可选）"
 * }
 *
 * 功能：
 * 1. 验证子任务存在性
 * 2. 检查子任务是否为非关键任务
 * 3. 更新子任务状态为 'skipped'
 * 4. 检查并更新父任务进展
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
    const { reason = '用户跳过', skippedBy = 'user' } = body;

    console.log(`⏭️ 跳过子任务`);
    console.log(`  📍 子任务 ID: ${subTaskId}`);
    console.log(`  📋 跳过原因: ${reason}`);

    // 调用状态机的跳过方法
    const result = await TaskStateMachine.skipSubTask(
      subTaskId,
      reason,
      skippedBy
    );

    return NextResponse.json({
      success: true,
      message: '子任务已跳过',
      data: result.subTask,
    }, { status: 200 });
  } catch (error: any) {
    console.error(`❌ 跳过子任务失败:`, error);

    return NextResponse.json({
      success: false,
      error: error.message,
      message: error.message,
    }, { status: 400 });
  }
}
