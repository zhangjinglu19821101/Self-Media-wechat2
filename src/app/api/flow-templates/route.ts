/**
 * 流程模板 API
 *
 * GET /api/flow-templates?platform=xxx
 * GET /api/flow-templates （返回所有模板）
 *
 * 供前端获取各平台的流程模板，用于子任务列表初始化
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllFlowTemplates, getFlowTemplate, PLATFORM_FLOW_MAP } from '@/lib/agents/flow-templates';

export async function GET(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get('platform');

  if (platform) {
    const template = getFlowTemplate(platform);
    return NextResponse.json({
      success: true,
      data: template,
    });
  }

  // 返回所有模板
  return NextResponse.json({
    success: true,
    data: getAllFlowTemplates(),
  });
}
