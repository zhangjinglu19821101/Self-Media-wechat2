/**
 * 规则查询API
 * GET /api/rules - 查询规则列表
 * POST /api/rules - 创建规则
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { ruleManager } from '@/lib/rule-manager';
import { RuleFilter, RuleCategory, RuleStatus, RuleScope, PermissionAction } from '@/lib/rule-types';
import { permissionManager } from '@/lib/permission-manager';
import { AgentId } from '@/lib/agent-types';

/**
 * GET /api/rules - 查询规则列表
 */
export async function GET(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId') as AgentId;
    const category = searchParams.get('category') as RuleCategory;
    const status = searchParams.get('status') as RuleStatus;
    const scope = searchParams.get('scope') as RuleScope;
    const keyword = searchParams.get('keyword');

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

    // 构建过滤器
    const filter: RuleFilter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (scope) filter.scope = scope;
    if (keyword) filter.keyword = keyword;

    // 查询规则
    let rules = ruleManager.queryRules(filter);

    // 权限过滤
    const filteredRules = rules.filter((rule) => {
      // Agent B可以查看所有规则
      if (agentId === 'B') {
        return true;
      }

      // 检查权限
      return permissionManager.checkRulePermission(agentId, rule.id, PermissionAction.READ);
    });

    return NextResponse.json({
      success: true,
      data: filteredRules,
      total: filteredRules.length,
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

/**
 * POST /api/rules - 创建规则
 */
export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    // 只有Agent B可以创建规则
    const body = await request.json();
    const { agentId, ...ruleData } = body;

    if (agentId !== 'B') {
      return NextResponse.json(
        {
          success: false,
          error: '只有Agent B可以创建规则',
        },
        { status: 403 }
      );
    }

    // 验证必填字段
    const requiredFields = ['name', 'description', 'category', 'status', 'scope', 'version'];
    for (const field of requiredFields) {
      if (!ruleData[field]) {
        return NextResponse.json(
          {
            success: false,
            error: `缺少必填字段: ${field}`,
          },
          { status: 400 }
        );
      }
    }

    // 验证核心四要素
    const coreFields = ['scopeDescription', 'decompositionActions', 'judgmentCriteria', 'landingCarrier'];
    for (const field of coreFields) {
      if (!ruleData[field]) {
        return NextResponse.json(
          {
            success: false,
            error: `缺少核心要素: ${field}`,
          },
          { status: 400 }
        );
      }
    }

    // 保存规则
    const result = ruleManager.saveRule({
      ...ruleData,
      createdBy: 'B',
      tags: ruleData.tags || [],
      relatedExperienceIds: ruleData.relatedExperienceIds || [],
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ruleId: result.ruleId,
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
