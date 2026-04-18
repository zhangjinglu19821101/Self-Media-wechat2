import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { TaskStateMachine } from '@/lib/services/task-state-machine';

/**
 * 恢复失败的任务
 *
 * POST /api/tasks/:id/recover
 *
 * 请求体：
 * {
 *   "reason": "恢复原因（可选）",
 *   "recoveredBy": "恢复操作者（可选）"
 * }
 *
 * 功能：
 * 1. 验证任务存在性
 * 2. 检查任务状态是否可以恢复（必须是 failed）
 * 3. 检查所有指令是否都已完成或跳过
 * 4. 更新任务状态为 'in_progress'
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { id: taskId } = await params;
    const body = await request.json();
    const { reason = '用户恢复', recoveredBy = 'user' } = body;

    console.log(`🔄 恢复任务`);
    console.log(`  📍 任务 ID: ${taskId}`);
    console.log(`  📋 恢复原因: ${reason}`);

    // 调用状态机的恢复方法
    const result = await TaskStateMachine.recoverTask(
      taskId,
      reason,
      recoveredBy
    );

    return NextResponse.json({
      success: true,
      message: '任务已恢复',
      data: result.task,
    }, { status: 200 });
  } catch (error: any) {
    console.error(`❌ 恢复任务失败:`, error);

    return NextResponse.json({
      success: false,
      error: error.message,
      message: error.message,
    }, { status: 400 });
  }
}
