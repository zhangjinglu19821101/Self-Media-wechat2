import { NextRequest, NextResponse } from 'next/server';
import { globalScheduler } from '@/lib/global-schedule/scheduler';

/**
 * POST /api/schedule/trigger
 * 手动触发巡检
 */
export async function POST(request: NextRequest) {
  console.log('📥 === /api/schedule/trigger 收到手动触发巡检请求 ===');

  try {
    // 触发巡检
    await globalScheduler.triggerInspection();

    return NextResponse.json({
      success: true,
      message: '巡检已触发'
    });
  } catch (error) {
    console.error('触发巡检失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '触发巡检失败'
      },
      { status: 500 }
    );
  }
}
