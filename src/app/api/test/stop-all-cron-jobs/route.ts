import { NextRequest, NextResponse } from 'next/server';
import { stopAllCronJobs, getCronJobsStatus } from '@/lib/cron';

export async function POST(request: NextRequest) {
  try {
    console.log('[StopAllCronJobs] 开始停止所有定时任务...');

    // 先获取当前状态
    const beforeStatus = getCronJobsStatus();
    console.log('[StopAllCronJobs] 停止前状态:', beforeStatus);

    // 停止所有定时任务
    stopAllCronJobs();

    // 再获取停止后的状态
    const afterStatus = getCronJobsStatus();
    console.log('[StopAllCronJobs] 停止后状态:', afterStatus);

    return NextResponse.json({
      success: true,
      message: '所有定时任务已停止',
      beforeStatus,
      afterStatus
    });

  } catch (error) {
    console.error('[StopAllCronJobs] 错误:', error);
    return NextResponse.json(
      { error: '停止失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const status = getCronJobsStatus();
    return NextResponse.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('[StopAllCronJobs] 错误:', error);
    return NextResponse.json(
      { error: '获取状态失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
