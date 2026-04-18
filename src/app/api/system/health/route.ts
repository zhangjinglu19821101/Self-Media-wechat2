import { NextRequest, NextResponse } from 'next/server';
import { getOrchestrationEngine } from '@/lib/orchestration/instance';
import { getAgentManager } from '@/lib/agent-manager/instance';

/**
 * GET /api/system/health
 * 获取系统整体健康状态
 */
export async function GET() {
  try {
    const orchestrationEngine = getOrchestrationEngine();
    const agentManager = getAgentManager();

    const orchestrationStats = orchestrationEngine.getStats();
    const agentStats = agentManager.getStats();

    return NextResponse.json({
      success: true,
      data: {
        orchestration: orchestrationStats,
        agents: agentStats,
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          platform: process.platform,
          nodeVersion: process.version,
          timestamp: Date.now(),
        },
      },
    });
  } catch (error: any) {
    console.error('Failed to get system health:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
