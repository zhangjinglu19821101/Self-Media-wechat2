// RAG 知识库 Collection 管理 API

import { NextRequest, NextResponse } from 'next/server';
import { getChromaDB } from '@/lib/rag/chroma-client';

/**
 * GET - 列出所有 Collections
 */
export async function GET(request: NextRequest) {
  try {
    const chromaDB = getChromaDB();
    const collections = await chromaDB.listCollections();

    // 获取每个Collection的统计信息
    const collectionStats = await Promise.all(
      collections.map(async (name) => {
        const stats = await chromaDB.getCollectionStats(name);
        return stats;
      })
    );

    return NextResponse.json({
      success: true,
      collections: collectionStats,
    });
  } catch (error: any) {
    console.error('Error listing collections:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list collections' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - 删除 Collection
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name');

    if (!name) {
      return NextResponse.json(
        { error: 'collection name is required' },
        { status: 400 }
      );
    }

    const chromaDB = getChromaDB();
    await chromaDB.deleteCollection(name);

    return NextResponse.json({
      success: true,
      message: `Collection "${name}" deleted successfully`,
    });
  } catch (error: any) {
    console.error('Error deleting collection:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete collection' },
      { status: 500 }
    );
  }
}
