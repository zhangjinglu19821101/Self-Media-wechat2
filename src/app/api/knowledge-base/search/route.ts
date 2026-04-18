/**
 * 知识库搜索 API
 * 支持搜索知识库中的内容
 */

import { NextRequest, NextResponse } from 'next/server';
import { knowledgeBaseManager, agentKnowledgeBase } from '@/lib/knowledge-base';

/**
 * GET /api/knowledge-base/search
 * 搜索知识库
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    const agentId = searchParams.get('agentId');
    const topK = searchParams.get('topK') ? parseInt(searchParams.get('topK')!) : 5;
    const minScore = searchParams.get('minScore')
      ? parseFloat(searchParams.get('minScore')!)
      : 0.0;

    // 验证必要字段
    if (!query) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必要参数: query',
        },
        { status: 400 }
      );
    }

    // 如果指定了 Agent，使用该 Agent 的知识库
    const manager =
      agentId && agentKnowledgeBase[agentId]
        ? agentKnowledgeBase[agentId]
        : knowledgeBaseManager;

    let result;
    if (agentId) {
      // 搜索特定 Agent 的记忆
      result = await manager.searchAgentMemory(agentId, query);
    } else {
      // 搜索全局知识库
      result = await manager.search(query, topK, minScore);
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: {
          query,
          results: result.results,
          count: result.results?.length || 0,
          agentId: agentId || 'global',
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
    console.error('Error searching knowledge base:', error);
    return NextResponse.json(
      {
        success: false,
        error: '搜索失败',
      },
      { status: 500 }
    );
  }
}
