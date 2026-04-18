/**
 * 工作流程 API - 统计路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { workflowEngine } from '@/lib/workflow-engine';

/**
 * GET /api/workflow/stats - 获取工作流程统计
 */
export async function GET(request: NextRequest) {
  try {
    const stats = workflowEngine.getStats();

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting workflow stats:', error);
    return NextResponse.json(
      { success: false, error: '获取统计失败' },
      { status: 500 }
    );
  }
}
