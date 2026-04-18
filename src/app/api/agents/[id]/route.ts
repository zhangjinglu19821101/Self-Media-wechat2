/**
 * Single Agent API
 * 提供单个 Agent 的查询、能力评估等接口
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { agentManager } from '@/lib/agent-manager';
import { AGENT_PROMPTS } from '@/lib/agent-prompts';

/**
 * GET /api/agents/:id - 获取指定 Agent
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { id } = await params;
    const agentId = id as any;
    const agent = agentManager.getAgent(agentId);

    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: `Agent ${agentId} not found`,
        },
        { status: 404 }
      );
    }

    // 获取 Agent 能力评估
    const capability = agentManager.evaluateAgentCapability(agentId);

    // 获取提示词
    const prompt = AGENT_PROMPTS[agentId];

    // 获取任务队列状态
    const queueStatus = agentManager.getTaskQueue(agentId);

    return NextResponse.json({
      success: true,
      data: {
        ...agent,
        prompt,
        capability,
        queueStatus,
      },
    });
  } catch (error) {
    console.error('Error fetching agent:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch agent',
      },
      { status: 500 }
    );
  }
}
