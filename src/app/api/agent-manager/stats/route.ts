import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/agent-manager/stats
 * 获取 Agent 管理器统计信息
 * 
 * 注意：此功能已迁移到新的任务系统
 */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: '此功能已迁移到新的任务系统',
      message: 'Agent 统计信息请使用 /api/tasks 接口查看',
    },
    { status: 410 }
  );
}
