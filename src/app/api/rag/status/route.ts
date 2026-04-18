// RAG 状态查询 API

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { getRAGIntegration } from '@/lib/rag/rag-integration';
import { getChromaDB } from '@/lib/rag/chroma-client';

/**
 * GET /api/rag/status
 * 获取 RAG 系统状态和知识库信息
 */
export async function GET(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const ragIntegration = getRAGIntegration();
    const chromaDB = getChromaDB();

    // 获取配置
    const config = ragIntegration.getConfig();

    // 获取所有 collection 状态
    const collections = await chromaDB.listCollections();

    const collectionStats = await Promise.all(
      collections.map(async (name: string) => {
        try {
          const stats = await chromaDB.getCollectionStats(name);
          return {
            name,
            documentCount: stats.count,
            available: stats.count > 0,
          };
        } catch (error) {
          console.error(`[RAG Status] 获取 collection ${name} 状态失败:`, error);
          return {
            name,
            documentCount: 0,
            available: false,
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        ragEnabled: config.enabled,
        config: {
          minScore: config.minScore,
          topK: config.topK,
          maxContextLength: config.maxContextLength,
        },
        collections: collectionStats,
        totalCollections: collections.length,
      },
    });
  } catch (error: any) {
    console.error('[RAG Status] 获取 RAG 状态失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get RAG status',
      },
      { status: 500 }
    );
  }
}
