import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { insuranceDSplitTask } from '@/lib/services/task-assignment-service';

/**
 * POST /api/split-insurance-d-task
 * 将 insurance-d 的任务拆解，使用统一的 insuranceDSplitTask 函数
 */
export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const body = await request.json();
    const { taskId } = body;

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: '缺少 taskId 参数' },
        { status: 400 }
      );
    }

    console.log('🔧 [insurance-d 拆解] API 被调用，taskId:', taskId);

    // 🔥 关键：直接调用统一的 insuranceDSplitTask 函数
    const result = await insuranceDSplitTask(taskId);

    console.log('✅ [insurance-d 拆解] 完成:', result);

    return NextResponse.json({
      success: true,
      message: '任务拆解完成，等待用户确认',
      data: result,
    });
  } catch (error) {
    console.error('❌ [insurance-d 拆解] API 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
