import { NextRequest, NextResponse } from 'next/server';
import { agentBuilder } from '@/lib/agent-builder';
import type { AgentId } from '@/lib/agent-types';

/**
 * GET /api/admin/agent-builder/agent/[id]
 * 获取指定 Agent 的详细信息
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
    console.error('Error fetching agent:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取 Agent 信息失败',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/agent-builder/agent/[id]
 * 更新指定 Agent 的信息
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

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

    // 更新 Agent 信息
    if (body.name) agent.name = body.name;
    if (body.role) agent.role = body.role;
    if (body.description !== undefined) agent.description = body.description;
    if (body.systemPrompt) agent.systemPrompt = body.systemPrompt;
    if (body.maxConcurrentTasks) agent.maxConcurrentTasks = body.maxConcurrentTasks;
    if (body.canSendTo) agent.canSendTo = body.canSendTo;
    if (body.canReceiveFrom) agent.canReceiveFrom = body.canReceiveFrom;

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
    console.error('Error updating agent:', error);
    return NextResponse.json(
      {
        success: false,
        error: '更新 Agent 信息失败',
      },
      { status: 500 }
    );
  }
}
