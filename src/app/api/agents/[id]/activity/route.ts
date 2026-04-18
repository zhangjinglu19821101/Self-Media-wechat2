/**
 * Agent 活动监控 API - 单个 Agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { agentActivityMonitor } from '@/lib/agent-activity-monitor';

/**
 * GET /api/agents/[id]/activity
 * 获取指定 Agent 的活动状态
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { id } = await params;
    const activity = agentActivityMonitor.getActivity(id as any);

    if (!activity) {
      return NextResponse.json(
        { success: false, error: 'Agent 不存在' },
        { status: 404 }
      );
    }

    const logs = agentActivityMonitor.getLogs(id as any, 20);

    return NextResponse.json({
      success: true,
      data: {
        activity,
        logs,
      },
    });
  } catch (error) {
    console.error('Error getting agent activity:', error);
    return NextResponse.json(
      { success: false, error: '获取活动状态失败' },
      { status: 500 }
    );
  }
}
