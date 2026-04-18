/**
 * 权限检查API
 * POST /api/permissions/check - 检查权限
 */

import { NextRequest, NextResponse } from 'next/server';
import { permissionManager } from '@/lib/permission-manager';
import { PermissionAction, RuleScope } from '@/lib/rule-types';
import { AgentId } from '@/lib/agent-types';

/**
 * POST /api/permissions/check - 检查权限
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, ruleScope, action } = body;

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

    if (!action) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少action参数',
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

    // 验证action
    const validActions = Object.values(PermissionAction);
    if (!validActions.includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: '无效的action',
        },
        { status: 400 }
      );
    }

    // 检查权限
    const hasPermission = permissionManager.checkPermission(
      agentId as AgentId,
      ruleScope as RuleScope,
      action as PermissionAction
    );

    return NextResponse.json({
      success: true,
      data: {
        hasPermission,
      },
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
