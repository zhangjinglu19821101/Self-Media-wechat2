import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/schedule/status
 * 获取全局调度服务状态
 * 
 * 注意：此功能已迁移到新的任务系统，任务调度现在由 SubtaskExecutionEngine 自动处理
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: '此功能已迁移到新的任务系统',
      message: '任务调度现在由 SubtaskExecutionEngine 自动处理，请使用 /api/tasks 接口查看任务状态',
    },
    { status: 410 } // 410 Gone - 表示资源已不存在
  );
}
