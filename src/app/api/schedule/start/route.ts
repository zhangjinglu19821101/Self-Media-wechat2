import { NextRequest, NextResponse } from 'next/server';
import { globalScheduler } from '@/lib/global-schedule/scheduler';

/**
 * POST /api/schedule/start
 * 启动全局调度服务
 */
export async function POST(request: NextRequest) {
  console.log('📥 === /api/schedule/start 收到启动调度服务请求 ===');

  try {
    // 初始化调度器
    await globalScheduler.initialize();

    // 获取状态
    const status = globalScheduler.getStatus();

    return NextResponse.json({
      success: true,
      message: '全局调度服务已启动',
      data: status
    });
  } catch (error) {
    console.error('启动调度服务失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '启动失败'
      },
      { status: 500 }
    );
  }
}
