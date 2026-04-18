/**
 * 任务拆解API
 * POST /api/decompose - 执行任务拆解
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { decompositionEngine } from '@/lib/decomposition-engine';
import { Task, RuleScope } from '@/lib/rule-types';
import { AgentId } from '@/lib/agent-types';

/**
 * POST /api/decompose - 执行任务拆解
 */
export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const body = await request.json();
    const { agentId, task, ruleId } = body;

    // 验证必填参数
    if (!agentId) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少agentId参数',
        },
        { status: 400 }
      );
    }

    if (!task) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少task参数',
        },
        { status: 400 }
      );
    }

    // 验证Agent身份
    const validAgents: AgentId[] = ['A', 'B', 'C', 'D', 'insurance-c', 'insurance-d'];
    if (!validAgents.includes(agentId)) {
      return NextResponse.json(
        {
          success: false,
          error: '无效的agentId',
        },
        { status: 400 }
      );
    }

    // 验证必填字段
    const requiredFields = ['type', 'description', 'targetScope'];
    for (const field of requiredFields) {
      if (!task[field]) {
        return NextResponse.json(
          {
            success: false,
            error: `任务缺少必填字段: ${field}`,
          },
          { status: 400 }
        );
      }
    }

    // 验证targetScope
    const validScopes = [RuleScope.UNIVERSAL, RuleScope.AI, RuleScope.INSURANCE];
    if (!validScopes.includes(task.targetScope)) {
      return NextResponse.json(
        {
          success: false,
          error: '无效的targetScope',
        },
        { status: 400 }
      );
    }

    // 构建任务对象
    const taskObj: Task = {
      id: task.id || `task_${Date.now()}`,
      type: task.type,
      description: task.description,
      targetScope: task.targetScope,
      requirements: task.requirements || [],
      priority: task.priority || 'medium',
      createdBy: agentId as AgentId,
      createdAt: task.createdAt ? new Date(task.createdAt) : new Date(),
      deadline: task.deadline ? new Date(task.deadline) : undefined,
    };

    // 执行任务拆解
    const result = decompositionEngine.decompose(taskObj, ruleId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
