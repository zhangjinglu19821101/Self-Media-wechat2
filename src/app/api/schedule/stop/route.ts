import { NextRequest, NextResponse } from 'next/server';
import { globalScheduler } from '@/lib/global-schedule/scheduler';

/**
 * POST /api/schedule/stop
 * 停止全局调度服务
 */
export async function POST(request: NextRequest) {
  console.log('📥 === /api/schedule/stop 收到停止调度服务请求 ===');

  try {
    // 停止调度器
    globalScheduler.stopInspection();

    // 获取状态
    const status = globalScheduler.getStatus();

    return NextResponse.json({
      success: true,
      message: '全局调度服务已停止',
      data: status
    });
  } catch (error) {
    console.error('停止调度服务失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '停止失败'
      },
      { status: 500 }
    );
  }
}
