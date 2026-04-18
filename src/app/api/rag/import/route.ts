// RAG 知识库批量导入 API

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { createVectorImporter } from '@/lib/rag/vector-importer';
import type { DocumentMetadata } from '@/lib/rag/document-processor';

/**
 * POST - 批量导入文档到知识库
 */
export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const body = await request.json();
    const { documents, collectionName } = body;

    // 验证参数
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json(
        { error: 'documents array is required' },
        { status: 400 }
      );
    }

    // 验证每个文档的结构
    for (const doc of documents) {
      if (!doc.text) {
        return NextResponse.json(
          { error: 'Each document must have a text field' },
          { status: 400 }
        );
      }
      if (!doc.metadata || !doc.metadata.source) {
        return NextResponse.json(
          { error: 'Each document must have metadata.source field' },
          { status: 400 }
        );
      }
    }

    // 执行批量导入
    const importer = createVectorImporter();
    const result = await importer.importBatch(
      documents.map(doc => ({
        text: doc.text,
        metadata: doc.metadata as DocumentMetadata,
      })),
      {
        collectionName,
        batchSize: 50,
        onProgress: (progress) => {
          console.log('Import progress:', progress);
        },
      }
    );

    return NextResponse.json({
      success: true,
      totalChunks: result.totalChunks,
      documentCount: documents.length,
      message: `Imported ${documents.length} documents (${result.totalChunks} chunks)`,
    });
  } catch (error: any) {
    console.error('Error importing documents:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import documents' },
      { status: 500 }
    );
  }
}
