import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/articles/generate/status
 * 获取文章生成调度器状态
 * 
 * 注意：此功能已迁移到新的任务系统，请使用 /api/tasks 接口
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: '此功能已迁移到新的任务系统',
      message: '请使用 /api/tasks 接口查看任务状态',
    },
    { status: 410 } // 410 Gone - 表示资源已不存在
  );
}
