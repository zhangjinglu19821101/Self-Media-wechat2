/**
 * 知识库导入 API
 * 支持导入文本和 URL 到知识库
 */

import { NextRequest, NextResponse } from 'next/server';
import { knowledgeBaseManager, agentKnowledgeBase } from '@/lib/knowledge-base';

/**
 * POST /api/knowledge-base/add
 * 导入内容到知识库
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, type = 'text', agentId, memoryType = 'experience' } = body;

    // 验证必要字段
    if (!content) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必要字段: content',
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

    if (type === 'url') {
      // 导入 URL
      result = await manager.importUrl(content);
    } else {
      // 导入文本
      const metadata = agentId ? { agentId, type: memoryType } : undefined;
      result = await manager.importText(content, metadata);
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        data: {
          docId: result.docId,
          type: type,
          agentId: agentId || 'global',
        },
        message: '导入成功',
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
    console.error('Error importing to knowledge base:', error);
    return NextResponse.json(
      {
        success: false,
        error: '导入失败',
      },
      { status: 500 }
    );
  }
}
