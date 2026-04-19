import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/test/execute-order-4-direct
 * 直接执行 order_index=4 的任务
 * 
 * 注意：此功能已迁移到新的任务系统
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: '此功能已迁移到新的任务系统',
      message: '任务执行现在由 SubtaskExecutionEngine 自动处理，请使用 /api/tasks 接口',
    },
    { status: 410 }
  );
}
