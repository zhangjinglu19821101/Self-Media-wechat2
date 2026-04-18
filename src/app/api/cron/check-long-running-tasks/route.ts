import { NextRequest, NextResponse } from 'next/server';
import { manuallyCheckLongRunningTasks } from '@/lib/cron/tasks/check-long-running-tasks';

/**
 * POST /api/cron/check-long-running-tasks
 * 手动触发超长任务巡检
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔔 手动触发超长任务巡检...');

    await manuallyCheckLongRunningTasks();

    return NextResponse.json({
      success: true,
      message: '超长任务巡检已完成',
    });
  } catch (error) {
    console.error('❌ 超长任务巡检失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '巡检失败',
      },
      { status: 500 }
    );
  }
}
