/**
 * 工作流程 API - 模板路由
 */

import { NextRequest, NextResponse } from 'next/server';
import { workflowEngine } from '@/lib/workflow-engine';

/**
 * GET /api/workflow/template - 获取工作流程模板
 */
export async function GET(request: NextRequest) {
  try {
    const template = workflowEngine.getTemplate();

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Error getting workflow template:', error);
    return NextResponse.json(
      { success: false, error: '获取模板失败' },
      { status: 500 }
    );
  }
}
