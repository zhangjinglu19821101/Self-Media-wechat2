/**
 * 执行子任务
 * POST /api/subtasks/:id/execute
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeSubTask } from '@/lib/agents/task-executor';
import { requireAuth } from '@/lib/auth/context';
import { handleRouteError } from '@/lib/api/route-error-handler';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const params = await context.params;
    const { id: subTaskId } = params;

    console.log(`📥 收到执行子任务请求: ${subTaskId}`);

    if (!subTaskId) {
      return NextResponse.json({
        success: false,
        error: '子任务 ID 缺失',
        message: '请求参数错误',
      }, { status: 400 });
    }

    // 执行子任务
    const result = await executeSubTask(subTaskId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: '子任务执行成功',
        result: result.result,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        message: '子任务执行失败',
      }, { status: 500 });
    }
  } catch (error) {
    console.error(`❌ 执行子任务失败:`, error);
    return handleRouteError(error, '执行子任务失败');
  }
}

/**
 * GET /api/subtasks/:id/execute
 * 获取子任务执行信息（可选）
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const params = await context.params;
    const { id: subTaskId } = params;

    return NextResponse.json({
      success: true,
      message: '子任务执行 API',
      description: '执行指定 ID 的子任务',
      usage: {
        method: 'POST',
        endpoint: `/api/subtasks/${subTaskId}/execute`,
      },
    });
  } catch (error) {
    console.error(`❌ 获取执行信息失败:`, error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    }, { status: 500 });
  }
}
