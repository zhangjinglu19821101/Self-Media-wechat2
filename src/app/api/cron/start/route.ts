import { NextRequest, NextResponse } from 'next/server';
import { startAllCronJobs, stopAllCronJobs, getCronJobsStatus } from '@/lib/cron/scheduler';

/**
 * POST /api/cron/start
 * 启动所有定时任务
 */
export async function POST() {
  try {
    startAllCronJobs();

    return NextResponse.json({
      success: true,
      message: '定时任务已启动',
      status: getCronJobsStatus(),
    });
  } catch (error) {
    console.error('❌ 启动定时任务失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

/**
 * DELETE /api/cron/start
 * 停止所有定时任务
 */
export async function DELETE() {
  try {
    stopAllCronJobs();

    return NextResponse.json({
      success: true,
      message: '定时任务已停止',
    });
  } catch (error) {
    console.error('❌ 停止定时任务失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

/**
 * GET /api/cron/start
 * 查询定时任务状态
 */
export async function GET() {
  try {
    const status = getCronJobsStatus();

    return NextResponse.json({
      success: true,
      status,
      message: `当前有 ${status.length} 个定时任务`,
    });
  } catch (error) {
    console.error('❌ 查询定时任务状态失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
