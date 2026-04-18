import { NextRequest, NextResponse } from 'next/server';
import { getAgentManager } from '@/lib/agent-manager';

/**
 * GET /api/agent-manager/stats
 * 获取 Agent 管理器统计信息
 */
export async function GET() {
  try {
    const manager = getAgentManager();
    const stats = manager.getStats();

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Failed to get agent manager stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
