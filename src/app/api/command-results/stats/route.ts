/**
 * GET /api/command-results/stats
 * 获取指令执行结果统计信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { commandResultService } from '@/lib/services/command-result-service';
import { requireAuth } from '@/lib/auth/context';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const searchParams = request.nextUrl.searchParams;

    const params = {
      toAgentId: searchParams.get('toAgentId') || undefined,
      startDate: searchParams.get('startDate')
        ? new Date(searchParams.get('startDate')!)
        : undefined,
      endDate: searchParams.get('endDate')
        ? new Date(searchParams.get('endDate')!)
        : undefined,
    };

    const stats = await commandResultService.getStats(params);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取统计信息失败',
      },
      { status: 500 }
    );
  }
}
