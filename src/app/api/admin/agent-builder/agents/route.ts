import { NextRequest, NextResponse } from 'next/server';
import { agentBuilder } from '@/lib/agent-builder';

/**
 * GET /api/admin/agent-builder/agents
 * 获取所有 Agent 列表
 */
export async function GET() {
  try {
    const agents = agentBuilder.getAllAgents();

    return NextResponse.json({
      success: true,
      data: agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        maxConcurrentTasks: agent.maxConcurrentTasks,
        canSendTo: agent.canSendTo,
        canReceiveFrom: agent.canReceiveFrom,
      })),
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取 Agent 列表失败',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/agent-builder/agents
 * 创建新的 Agent
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { id, name, role, description, systemPrompt, maxConcurrentTasks, canSendTo, canReceiveFrom } =
      body;

    if (!id || !name || !systemPrompt) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必填字段：id, name, systemPrompt',
        },
        { status: 400 }
      );
    }

    const agent = agentBuilder.createAgent({
      id,
      name,
      role: role || 'custom',
      description: description || '',
      systemPrompt,
      maxConcurrentTasks: maxConcurrentTasks || 3,
      canSendTo: canSendTo || [],
      canReceiveFrom: canReceiveFrom || [],
    });

    return NextResponse.json({
      success: true,
      data: {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        maxConcurrentTasks: agent.maxConcurrentTasks,
        canSendTo: agent.canSendTo,
        canReceiveFrom: agent.canReceiveFrom,
      },
    });
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      {
        success: false,
        error: '创建 Agent 失败',
      },
      { status: 500 }
    );
  }
}
