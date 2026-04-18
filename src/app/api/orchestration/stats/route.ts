import { NextRequest, NextResponse } from 'next/server';
import { getOrchestrationEngine } from '@/lib/orchestration/instance';

/**
 * GET /api/orchestration/stats
 * 获取编排引擎统计信息
 */
export async function GET() {
  try {
    const engine = getOrchestrationEngine();
    const stats = engine.getStats();

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Failed to get orchestration stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
