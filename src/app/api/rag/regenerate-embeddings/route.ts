// 重新生成已有文档的向量

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { getChromaDB } from '@/lib/rag/chroma-client';
import { getPlatformEmbedding } from '@/lib/llm/factory';

/**
 * POST /api/rag/regenerate-embeddings
 * 为指定 collection 中的所有文档重新生成向量
 */
export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const body = await request.json();
    const { collectionName } = body;

    // 验证参数
    if (!collectionName) {
      return NextResponse.json(
        { error: 'collectionName is required' },
        { status: 400 }
      );
    }

    const chromaDB = getChromaDB();

    // 获取 collection 中的所有文档
    const stats = await chromaDB.getCollectionStats(collectionName);
    if (stats.count === 0) {
      return NextResponse.json(
        { error: `Collection "${collectionName}" is empty` },
        { status: 400 }
      );
    }

    console.log(`[RegenerateEmbeddings] 开始为 "${collectionName}" 重新生成向量，共 ${stats.count} 个文档`);

    // 从文件缓存中读取文档
    const fs = await import('fs/promises');
    const path = await import('path');
    const cacheFile = path.join(process.cwd(), 'data/rag-cache', `${collectionName}_vectors.json`);

    const cacheContent = await fs.readFile(cacheFile, 'utf-8');
    const cache = JSON.parse(cacheContent);

    if (!cache.documents || !Array.isArray(cache.documents)) {
      return NextResponse.json(
        { error: 'Invalid cache file format' },
        { status: 500 }
      );
    }

    // 检查是否已经有向量
    const documentsWithoutEmbedding = cache.documents.filter((doc: any) => !doc.embedding);
    const documentsWithEmbedding = cache.documents.filter((doc: any) => doc.embedding);

    console.log(`[RegenerateEmbeddings] 已有向量的文档: ${documentsWithEmbedding.length}`);
    console.log(`[RegenerateEmbeddings] 需要生成向量的文档: ${documentsWithoutEmbedding.length}`);

    if (documentsWithoutEmbedding.length === 0) {
      return NextResponse.json({
        success: true,
        message: '所有文档已生成向量，无需重新生成',
        totalDocuments: cache.documents.length,
        processed: 0,
      });
    }

    // 批量生成向量（使用平台 Embedding Client）
    console.log('[RegenerateEmbeddings] 开始生成向量...');
    const texts = documentsWithoutEmbedding.map((doc: any) => doc.text);
    const embeddingClient = getPlatformEmbedding();
    const embeddings = await embeddingClient.embedTexts(texts);

    // 将向量添加到文档
    documentsWithoutEmbedding.forEach((doc: any, index: number) => {
      doc.embedding = embeddings[index];
    });

    // 保存到缓存文件
    cache.documents = cache.documents.map((doc: any) => {
      const withEmbedding = documentsWithoutEmbedding.find((d: any) => d.id === doc.id);
      return withEmbedding || doc;
    });

    await fs.writeFile(cacheFile, JSON.stringify(cache, null, 2));

    console.log(`[RegenerateEmbeddings] 向量生成完成，共 ${documentsWithoutEmbedding.length} 个文档`);

    return NextResponse.json({
      success: true,
      message: '向量生成成功',
      totalDocuments: cache.documents.length,
      processed: documentsWithoutEmbedding.length,
      skipped: documentsWithEmbedding.length,
    });
  } catch (error: any) {
    console.error('[RegenerateEmbeddings] 重新生成向量失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '重新生成向量失败',
      },
      { status: 500 }
    );
  }
}
