/**
 * 工作流程 API - 确认路由
 * 用于人类确认步骤后继续工作流程
 */

import { NextRequest, NextResponse } from 'next/server';
import { workflowEngine } from '@/lib/workflow-engine';

/**
 * POST /api/workflow/[id]/confirm
 * 人类确认步骤
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { stepId, agentId, approved, comment } = body;

    if (!stepId || !agentId) {
      return NextResponse.json(
        { success: false, error: '缺少必需参数' },
        { status: 400 }
      );
    }

    const workflow = await workflowEngine.confirmStep(
      id,
      stepId,
      agentId,
      approved,
      comment
    );

    if (!workflow) {
      return NextResponse.json(
        { success: false, error: '工作流程不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    console.error('Error confirming step:', error);
    return NextResponse.json(
      { success: false, error: '确认失败' },
      { status: 500 }
    );
  }
}
