import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/schedule/stop
 * 停止全局调度器
 * 
 * 注意：此功能已迁移到新的任务系统，任务调度现在由 SubtaskExecutionEngine 自动处理
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: '此功能已迁移到新的任务系统',
      message: '任务调度现在由 SubtaskExecutionEngine 自动处理',
    },
    { status: 410 } // 410 Gone - 表示资源已不存在
  );
}
