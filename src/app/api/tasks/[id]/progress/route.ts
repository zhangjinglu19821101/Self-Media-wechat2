import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { TaskManager } from '@/lib/services/task-manager';

/**
 * POST /api/tasks/[id]/progress
 * 添加任务进展
 *
 * 允许 Agent 记录任务执行过程中的进展
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('📥 === /api/tasks/[id]/progress 收到任务进展添加请求 ===');

  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id: taskId } = await params;
    const body = await request.json();
    const { progress } = body;

    console.log('📦 请求参数:');
    console.log('  - taskId:', taskId);
    console.log('  - progress:', progress?.substring(0, 200) || '无');

    if (!progress) {
      console.log('❌ 参数验证失败: 缺少 progress 参数');
      return NextResponse.json(
        {
          success: false,
          error: '缺少必需参数：progress',
        },
        { status: 400 }
      );
    }

    // 添加任务进展
    await TaskManager.addTaskProgress(taskId, progress);

    console.log(`✅ 任务进展已添加: taskId=${taskId}`);

    return NextResponse.json(
      {
        success: true,
        message: '任务进展已添加',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error adding task progress:', error);

    return NextResponse.json(
      {
        success: false,
        error: '添加任务进展失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
