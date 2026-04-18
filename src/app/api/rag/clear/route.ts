// RAG 知识库清空 Collection API

import { NextRequest, NextResponse } from 'next/server';
import { getChromaDB } from '@/lib/rag/chroma-client';

/**
 * POST - 清空指定 Collection 的所有文档
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { collectionName } = body;

    if (!collectionName) {
      return NextResponse.json(
        { error: 'collectionName is required' },
        { status: 400 }
      );
    }

    const chromaDB = getChromaDB();
    await chromaDB.clearCollection(collectionName);

    return NextResponse.json({
      success: true,
      message: `Collection "${collectionName}" cleared successfully`,
    });
  } catch (error: any) {
    console.error('Error clearing collection:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to clear collection' },
      { status: 500 }
    );
  }
}
