/**
 * Agent 活动监控 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentActivityMonitor } from '@/lib/agent-activity-monitor';

/**
 * GET /api/agents/activity
 * 获取所有 Agent 的活动状态
 */
export async function GET(request: NextRequest) {
  try {
    const activities = agentActivityMonitor.getAllActivities();

    return NextResponse.json({
      success: true,
      data: activities,
    });
  } catch (error) {
    console.error('Error getting agent activities:', error);
    return NextResponse.json(
      { success: false, error: '获取活动状态失败' },
      { status: 500 }
    );
  }
}
