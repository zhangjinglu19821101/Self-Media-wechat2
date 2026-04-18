// 向量导入工具 - 批量导入文档到向量库

import { getChromaDB } from './chroma-client';
import { DocumentProcessor, type DocumentMetadata } from './document-processor';
import { generateBatchEmbeddings } from '@/lib/embedding/doubao-embedding';
import type { DocumentChunk } from './types';

export interface ImportProgress {
  totalDocuments: number;
  processedDocuments: number;
  totalChunks: number;
  processedChunks: number;
  currentDocument?: string;
}

export interface ImportOptions {
  collectionName?: string;
  batchSize?: number;
  onProgress?: (progress: ImportProgress) => void;
}

export class VectorImporter {
  private processor: DocumentProcessor;
  private batchSize: number;

  constructor() {
    this.processor = new DocumentProcessor();
    this.batchSize = 50; // 每批处理50个chunks
  }

  /**
   * 导入单个文档
   */
  async importDocument(
    text: string,
    metadata: DocumentMetadata,
    options: ImportOptions = {}
  ): Promise<number> {
    const collectionName = options.collectionName || 'knowledge_base';

    // 分割文档
    const chunks = this.processor.splitIntoChunks(text, metadata);

    // 为所有 chunks 生成向量
    console.log(`[VectorImporter] 为 ${chunks.length} 个 chunks 生成向量...`);
    const texts = chunks.map(chunk => chunk.text);
    const embeddings = await generateBatchEmbeddings(texts);

    // 将向量添加到 chunks
    chunks.forEach((chunk, index) => {
      chunk.embedding = embeddings[index];
    });

    // 添加到向量库
    const chromaDB = getChromaDB();
    await chromaDB.addDocuments(collectionName, chunks);

    return chunks.length;
  }

  /**
   * 批量导入文档
   */
  async importBatch(
    documents: Array<{ text: string; metadata: DocumentMetadata }>,
    options: ImportOptions = {}
  ): Promise<{ totalChunks: number }> {
    const collectionName = options.collectionName || 'knowledge_base';
    const batchSize = options.batchSize || this.batchSize;

    const chromaDB = getChromaDB();
    let totalChunks = 0;
    let processedChunks = 0;

    // 处理所有文档并分块
    const allChunks: DocumentChunk[] = [];
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const chunks = this.processor.splitIntoChunks(doc.text, doc.metadata);
      allChunks.push(...chunks);

      // 报告进度
      if (options.onProgress) {
        options.onProgress({
          totalDocuments: documents.length,
          processedDocuments: i + 1,
          totalChunks: allChunks.length,
          processedChunks,
          currentDocument: doc.metadata.title || doc.metadata.source,
        });
      }
    }

    // 分批添加到向量库
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);

      // 为当前批次生成向量
      console.log(`[VectorImporter] 为批次 ${i + 1}-${Math.min(i + batchSize, allChunks.length)} 生成向量...`);
      const texts = batch.map(chunk => chunk.text);
      const embeddings = await generateBatchEmbeddings(texts);

      // 将向量添加到 chunks
      batch.forEach((chunk, index) => {
        chunk.embedding = embeddings[index];
      });

      await chromaDB.addDocuments(collectionName, batch);
      processedChunks += batch.length;

      // 报告进度
      if (options.onProgress) {
        options.onProgress({
          totalDocuments: documents.length,
          processedDocuments: documents.length,
          totalChunks: allChunks.length,
          processedChunks,
        });
      }

      // 添加延迟，避免过载
      await this.sleep(100);
    }

    return { totalChunks: allChunks.length };
  }

  /**
   * 从文件导入
   */
  async importFromFile(
    filePath: string,
    metadata: DocumentMetadata,
    options: ImportOptions = {}
  ): Promise<number> {
    const fs = await import('fs/promises');
    const text = await fs.readFile(filePath, 'utf-8');

    return this.importDocument(text, metadata, options);
  }

  /**
   * 从目录导入多个文件
   */
  async importFromDirectory(
    directoryPath: string,
    options: ImportOptions & {
      fileFilter?: (filename: string) => boolean;
      metadataExtractor?: (filename: string) => Partial<DocumentMetadata>;
    } = {}
  ): Promise<{ totalChunks: number }> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const files = await fs.readdir(directoryPath);
    const documents: Array<{ text: string; metadata: DocumentMetadata }> = [];

    for (const file of files) {
      const filePath = path.join(directoryPath, file);

      // 检查是否是文件
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) continue;

      // 应用文件过滤器
      if (options.fileFilter && !options.fileFilter(file)) continue;

      // 读取文件内容
      const text = await fs.readFile(filePath, 'utf-8');

      // 提取元数据
      const baseMetadata: DocumentMetadata = {
        source: filePath,
        title: file,
        ...options.metadataExtractor?.(file),
      };

      documents.push({
        text,
        metadata: baseMetadata,
      });
    }

    return this.importBatch(documents, options);
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 创建默认的向量导入器
 */
export function createVectorImporter(): VectorImporter {
  return new VectorImporter();
}
