/**
 * 工作流程 API - 主路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { workflowEngine } from '@/lib/workflow-engine';
import { WorkflowTriggerRequest, WorkflowQuery } from '@/lib/workflow-types';
import { TaskPriority } from '@/lib/agent-types';

/**
 * GET /api/workflow - 查询工作流程列表
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const query: WorkflowQuery = {
      status: searchParams.get('status') as any || undefined,
      initiator: searchParams.get('initiator') as any || undefined,
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    const workflows = workflowEngine.queryWorkflows(query);

    return NextResponse.json({
      success: true,
      data: workflows,
      total: workflows.length,
    });
  } catch (error) {
    console.error('Error querying workflows:', error);
    return NextResponse.json(
      { success: false, error: '查询工作流程失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflow - 触发新的工作流程
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const triggerRequest: WorkflowTriggerRequest = {
      title: body.title,
      description: body.description,
      initiator: body.initiator || 'A',
      priority: body.priority || TaskPriority.MEDIUM,
      tags: body.tags || [],
      initialTasks: body.initialTasks || [],
    };

    const workflow = await workflowEngine.triggerWorkflow(triggerRequest);

    return NextResponse.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    console.error('Error triggering workflow:', error);
    return NextResponse.json(
      { success: false, error: '触发工作流程失败' },
      { status: 500 }
    );
  }
}
