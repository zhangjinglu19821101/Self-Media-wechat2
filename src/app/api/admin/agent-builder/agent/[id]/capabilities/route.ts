import { NextRequest, NextResponse } from 'next/server';
import { agentBuilder } from '@/lib/agent-builder';
import type { AgentId } from '@/lib/agent-types';

/**
 * GET /api/admin/agent-builder/agent/[id]/capabilities
 * 获取指定 Agent 的能力列表
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const agent = agentBuilder.getAgent(id as AgentId);

    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: `Agent ${id} 不存在`,
        },
        { status: 404 }
      );
    }

    const capabilities = agentBuilder.getAgentCapabilities(id as AgentId);

    return NextResponse.json({
      success: true,
      data: capabilities,
    });
  } catch (error) {
    console.error('Error fetching agent capabilities:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取 Agent 能力失败',
      },
      { status: 500 }
    );
  }
}
