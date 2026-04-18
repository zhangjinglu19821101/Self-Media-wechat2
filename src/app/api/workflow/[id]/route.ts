/**
 * 工作流程 API - 详情路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { workflowEngine } from '@/lib/workflow-engine';
import { WorkflowUpdateRequest } from '@/lib/workflow-types';

/**
 * GET /api/workflow/[id] - 获取工作流程详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const workflow = workflowEngine.getWorkflow(id);

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
    console.error('Error getting workflow:', error);
    return NextResponse.json(
      { success: false, error: '获取工作流程失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflow/[id] - 更新工作流程步骤
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateRequest: WorkflowUpdateRequest = {
      workflowId: id,
      stepId: body.stepId,
      action: body.action,
      result: body.result,
      feedback: body.feedback,
      attachments: body.attachments,
    };

    let workflow;
    switch (updateRequest.action) {
      case 'complete':
        workflow = await workflowEngine.completeStep(id, updateRequest);
        break;
      case 'fail':
      case 'pause':
      case 'resume':
        workflow = await workflowEngine.updateStep(id, updateRequest);
        break;
      default:
        return NextResponse.json(
          { success: false, error: '无效的操作类型' },
          { status: 400 }
        );
    }

    if (!workflow) {
      return NextResponse.json(
        { success: false, error: '工作流程不存在或步骤无效' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    console.error('Error updating workflow:', error);
    return NextResponse.json(
      { success: false, error: '更新工作流程失败' },
      { status: 500 }
    );
  }
}
