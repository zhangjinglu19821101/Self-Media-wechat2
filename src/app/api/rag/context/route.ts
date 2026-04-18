// RAG 知识库上下文检索 API - 专门供 Agent 调用

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { createVectorRetriever } from '@/lib/rag/retriever';

/**
 * POST - 获取相关上下文（供 Agent 使用）
 */
export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const body = await request.json();
    const { query, collectionName, topK, minScore } = body;

    // 验证参数
    if (!query) {
      return NextResponse.json(
        { error: 'query is required' },
        { status: 400 }
      );
    }

    // 执行检索并获取上下文
    const retriever = createVectorRetriever(collectionName);
    const context = await retriever.retrieveContext(query, {
      topK: topK || 5,
      minScore: minScore || 0.6,
    });

    // 如果没有找到相关文档
    if (!context) {
      return NextResponse.json({
        success: true,
        context: '',
        message: 'No relevant documents found',
      });
    }

    return NextResponse.json({
      success: true,
      context,
      message: 'Context retrieved successfully',
    });
  } catch (error: any) {
    console.error('Error retrieving context:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve context' },
      { status: 500 }
    );
  }
}
