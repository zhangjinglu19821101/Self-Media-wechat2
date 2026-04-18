/**
 * Agent 记忆统计 API
 * 获取 Agent 的记忆统计信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentKnowledgeBase } from '@/lib/knowledge-base';

/**
 * GET /api/knowledge-base/summary
 * 获取 Agent 的记忆统计
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId');

    // 验证 Agent ID
    if (!agentId) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必要参数: agentId',
        },
        { status: 400 }
      );
    }

    const manager = agentKnowledgeBase[agentId];
    if (!manager) {
      return NextResponse.json(
        {
          success: false,
          error: `Agent ${agentId} 不存在`,
        },
        { status: 404 }
      );
    }

    const result = await manager.getAgentMemorySummary(agentId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: {
          agentId,
          summary: result.summary,
        },
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error getting knowledge base summary:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取统计失败',
      },
      { status: 500 }
    );
  }
}
