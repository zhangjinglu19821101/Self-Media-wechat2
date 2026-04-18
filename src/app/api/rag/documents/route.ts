// RAG 知识库文档管理 API

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { createVectorImporter } from '@/lib/rag/vector-importer';
import { createVectorRetriever } from '@/lib/rag/retriever';
import { getChromaDB } from '@/lib/rag/chroma-client';
import type { DocumentMetadata } from '@/lib/rag/document-processor';

/**
 * POST - 添加文档到知识库
 */
export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const body = await request.json();
    const { text, metadata, collectionName } = body;

    // 验证参数
    if (!text) {
      return NextResponse.json(
        { error: 'text is required' },
        { status: 400 }
      );
    }

    if (!metadata) {
      return NextResponse.json(
        { error: 'metadata is required' },
        { status: 400 }
      );
    }

    if (!metadata.source) {
      return NextResponse.json(
        { error: 'metadata.source is required' },
        { status: 400 }
      );
    }

    // 导入文档
    const importer = createVectorImporter();
    const chunkCount = await importer.importDocument(text, metadata as DocumentMetadata, {
      collectionName,
    });

    return NextResponse.json({
      success: true,
      chunkCount,
      message: `Document added successfully (${chunkCount} chunks)`,
    });
  } catch (error: any) {
    console.error('Error adding document:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add document' },
      { status: 500 }
    );
  }
}

/**
 * GET - 搜索知识库
 */
export async function GET(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    const collectionName = searchParams.get('collectionName') || 'knowledge_base';
    const topK = parseInt(searchParams.get('topK') || '5', 10);
    const minScore = parseFloat(searchParams.get('minScore') || '0.6');

    // 验证参数
    if (!query) {
      return NextResponse.json(
        { error: 'query is required' },
        { status: 400 }
      );
    }

    // 执行检索
    const retriever = createVectorRetriever(collectionName);
    const result = await retriever.retrieve(query, {
      topK,
      minScore,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Error searching documents:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search documents' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - 删除文档
 */
export async function DELETE(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const searchParams = request.nextUrl.searchParams;
    const ids = searchParams.get('ids');
    const collectionName = searchParams.get('collectionName') || 'knowledge_base';

    if (!ids) {
      return NextResponse.json(
        { error: 'ids is required (comma-separated)' },
        { status: 400 }
      );
    }

    const idArray = ids.split(',').map(id => id.trim());

    const chromaDB = getChromaDB();
    await chromaDB.deleteDocuments(collectionName, idArray);

    return NextResponse.json({
      success: true,
      deletedCount: idArray.length,
      message: `Deleted ${idArray.length} documents`,
    });
  } catch (error: any) {
    console.error('Error deleting documents:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete documents' },
      { status: 500 }
    );
  }
}
