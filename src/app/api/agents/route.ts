/**
 * Agents API
 * 提供 Agent 的查询、更新等接口
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { agentManager } from '@/lib/agent-manager';
import { AGENT_PROMPTS } from '@/lib/agent-prompts';

/**
 * GET /api/agents - 获取所有 Agent
 */
export async function GET() {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const agents = agentManager.getAllAgents();

    // 为每个 Agent 添加提示词信息（只返回摘要，不返回完整内容）
    const agentsWithPrompts = agents.map((agent) => ({
      ...agent,
      promptSummary: {
        name: AGENT_PROMPTS[agent.id].systemPrompt?.split('\n')[0]?.substring(0, 100) || '',
        length: AGENT_PROMPTS[agent.id].systemPrompt?.length || 0,
      },
      hasBehaviorRules: !!AGENT_PROMPTS[agent.id].behaviorRules?.length,
      hasRestrictions: !!AGENT_PROMPTS[agent.id].restrictions?.length,
    }));

    return NextResponse.json({
      success: true,
      data: agentsWithPrompts,
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch agents',
      },
      { status: 500 }
    );
  }
}
