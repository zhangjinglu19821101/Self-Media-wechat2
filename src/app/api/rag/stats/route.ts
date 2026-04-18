// RAG 知识库统计信息 API

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { getChromaDB } from '@/lib/rag/chroma-client';

/**
 * GET - 获取知识库统计信息
 */
export async function GET(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const searchParams = request.nextUrl.searchParams;
    const collectionName = searchParams.get('collectionName');

    const chromaDB = getChromaDB();

    // 如果指定了collection，返回该collection的统计信息
    if (collectionName) {
      const stats = await chromaDB.getCollectionStats(collectionName);
      return NextResponse.json({
        success: true,
        collection: stats,
      });
    }

    // 否则返回所有collection的统计信息
    const collections = await chromaDB.listCollections();
    const collectionStats = await Promise.all(
      collections.map(async (name) => {
        const stats = await chromaDB.getCollectionStats(name);
        return stats;
      })
    );

    const totalChunks = collectionStats.reduce((sum, stat) => sum + stat.count, 0);

    return NextResponse.json({
      success: true,
      stats: {
        totalCollections: collections.length,
        totalChunks,
        collections: collectionStats,
      },
    });
  } catch (error: any) {
    console.error('Error getting stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get stats' },
      { status: 500 }
    );
  }
}
