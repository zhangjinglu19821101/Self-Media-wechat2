/**
 * 规则详情API
 * GET /api/rules/:id - 获取规则详情
 * PUT /api/rules/:id - 更新规则
 * DELETE /api/rules/:id - 删除规则
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { ruleManager } from '@/lib/rule-manager';
import { PermissionAction } from '@/lib/rule-types';
import { permissionManager } from '@/lib/permission-manager';

/**
 * GET /api/rules/:id - 获取规则详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { id: ruleId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId');

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

    // 获取规则
    const rule = ruleManager.getRule(ruleId);
    if (!rule) {
      return NextResponse.json(
        {
          success: false,
          error: '规则不存在',
        },
        { status: 404 }
      );
    }

    // 检查权限
    if (agentId !== 'B') {
      const hasPermission = permissionManager.checkRulePermission(
        agentId as any,
        ruleId,
        PermissionAction.READ
      );

      if (!hasPermission) {
        return NextResponse.json(
          {
            success: false,
            error: '无权限访问该规则',
          },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: rule,
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
 * PUT /api/rules/:id - 更新规则
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { id: ruleId } = await params;
    const body = await request.json();
    const { agentId, ...updates } = body;

    // 只有Agent B可以更新规则
    if (agentId !== 'B') {
      return NextResponse.json(
        {
          success: false,
          error: '只有Agent B可以更新规则',
        },
        { status: 403 }
      );
    }

    // 更新规则
    const result = ruleManager.updateRule(ruleId, updates);

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
 * DELETE /api/rules/:id - 删除规则
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { id: ruleId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId');

    // 只有Agent B可以删除规则
    if (agentId !== 'B') {
      return NextResponse.json(
        {
          success: false,
          error: '只有Agent B可以删除规则',
        },
        { status: 403 }
      );
    }

    // 删除规则
    const result = ruleManager.deleteRule(ruleId);

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
