// 文件向量数据库 - 使用文件缓存实现

import { IVectorDatabase } from './vector-db-interface';
import type { DocumentChunk, SearchResult } from './types';
import path from 'path';
import fs from 'fs/promises';

/**
 * 文件向量数据库
 *
 * 特点：
 * - 使用内存存储，快速访问
 * - 文件缓存持久化
 * - 启动时自动加载
 * - 操作后自动保存
 */
export class FileVectorDB implements IVectorDatabase {
  private collections: Map<string, DocumentChunk[]>;
  private cacheDir: string;
  private initialized: boolean;

  constructor() {
    this.collections = new Map();
    this.cacheDir = path.resolve(process.cwd(), './data/rag-cache');
    this.initialized = false;
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('📁 初始化文件向量数据库...');

    // 确保缓存目录存在
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error('创建缓存目录失败:', error);
    }

    // 从文件加载缓存
    await this.loadFromCache();

    this.initialized = true;

    console.log('✅ 文件向量数据库初始化完成');
  }

  /**
   * 添加文档
   */
  async addDocuments(
    collectionName: string,
    documents: DocumentChunk[]
  ): Promise<void> {
    if (!this.collections.has(collectionName)) {
      this.collections.set(collectionName, []);
    }

    const collection = this.collections.get(collectionName)!;
    collection.push(...documents);

    // 自动保存
    await this.saveToCache(collectionName);

    console.log(`✅ 已添加 ${documents.length} 个文档到 "${collectionName}"`);
  }

  /**
   * 查询文档（余弦相似度）
   */
  async queryDocuments(
    collectionName: string,
    queryEmbedding: number[],
    topK: number = 5
  ): Promise<SearchResult[]> {
    const collection = this.collections.get(collectionName);

    if (!collection || collection.length === 0) {
      console.log(`⚠️  Collection "${collectionName}" 为空`);
      return [];
    }

    // 计算相似度
    const results: SearchResult[] = collection
      .filter(doc => doc.embedding) // 只处理有向量的文档
      .map(doc => ({
        chunk: doc,
        score: this.cosineSimilarity(queryEmbedding, doc.embedding!),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    console.log(`🔍 查询 "${collectionName}" 返回 ${results.length} 个结果`);

    return results;
  }

  /**
   * 删除文档
   */
  async deleteDocuments(
    collectionName: string,
    ids: string[]
  ): Promise<void> {
    const collection = this.collections.get(collectionName);

    if (!collection) {
      console.log(`⚠️  Collection "${collectionName}" 不存在`);
      return;
    }

    const idSet = new Set(ids);
    const originalCount = collection.length;

    // 过滤掉要删除的文档
    const filtered = collection.filter(doc => !idSet.has(doc.id));
    this.collections.set(collectionName, filtered);

    // 自动保存
    await this.saveToCache(collectionName);

    console.log(
      `🗑️  已从 "${collectionName}" 删除 ${originalCount - filtered.length} 个文档`
    );
  }

  /**
   * 清空Collection
   */
  async clearCollection(collectionName: string): Promise<void> {
    const collection = this.collections.get(collectionName);

    if (!collection) {
      console.log(`⚠️  Collection "${collectionName}" 不存在`);
      return;
    }

    const count = collection.length;
    collection.length = 0;

    // 自动保存
    await this.saveToCache(collectionName);

    console.log(`🧹 已清空 "${collectionName}" (${count} 个文档)`);
  }

  /**
   * 获取统计信息
   */
  async getCollectionStats(collectionName: string): Promise<{
    count: number;
    name: string;
  }> {
    const collection = this.collections.get(collectionName);

    if (!collection) {
      return { count: 0, name: collectionName };
    }

    return {
      count: collection.length,
      name: collectionName,
    };
  }

  /**
   * 列出所有Collections
   */
  async listCollections(): Promise<string[]> {
    return Array.from(this.collections.keys());
  }

  /**
   * 关闭
   */
  async close(): Promise<void> {
    console.log('📁 关闭文件向量数据库');

    // 保存所有Collections
    for (const collectionName of this.collections.keys()) {
      await this.saveToCache(collectionName);
    }

    this.collections.clear();
    this.initialized = false;

    console.log('✅ 文件向量数据库已关闭');
  }

  // ==================== 私有方法 ====================

  /**
   * 从文件加载缓存
   */
  private async loadFromCache(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);

      for (const file of files) {
        if (file.endsWith('_vectors.json')) {
          const collectionName = file.replace('_vectors.json', '');
          await this.loadCollection(collectionName);
        }
      }

      console.log(
        `✅ 从缓存加载了 ${this.collections.size} 个 Collections`
      );
    } catch (error) {
      console.log('ℹ️  缓存目录为空或不存在，跳过加载');
    }
  }

  /**
   * 加载单个Collection
   */
  private async loadCollection(collectionName: string): Promise<void> {
    try {
      const cacheFile = path.join(this.cacheDir, `${collectionName}_vectors.json`);
      const content = await fs.readFile(cacheFile, 'utf-8');
      const cache = JSON.parse(content);

      // 验证缓存文件格式
      if (!cache.documents || !Array.isArray(cache.documents)) {
        console.log(`⚠️  缓存文件格式错误: ${collectionName}`);
        return;
      }

      this.collections.set(collectionName, cache.documents);

      console.log(`  ✓ 加载了 ${cache.documents.length} 个文档到 "${collectionName}"`);
    } catch (error) {
      console.log(`  ✗ 加载 "${collectionName}" 失败:`, (error as Error).message);
    }
  }

  /**
   * 保存到文件缓存
   */
  private async saveToCache(collectionName: string): Promise<void> {
    const collection = this.collections.get(collectionName);

    if (!collection) {
      return;
    }

    const cache = {
      version: '1.0',
      collectionName,
      lastUpdated: new Date().toISOString(),
      documentCount: collection.length,
      documents: collection.map(doc => ({
        id: doc.id,
        text: doc.text,
        embedding: doc.embedding,
        metadata: doc.metadata,
      })),
    };

    const cacheFile = path.join(this.cacheDir, `${collectionName}_vectors.json`);

    try {
      await fs.writeFile(cacheFile, JSON.stringify(cache, null, 2));
    } catch (error) {
      console.error(`保存 "${collectionName}" 缓存失败:`, error);
    }
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      console.warn('向量长度不一致');
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);

    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }
}

// 导出默认实例
let fileVectorDBInstance: FileVectorDB | null = null;

export function getFileVectorDB(): FileVectorDB {
  if (!fileVectorDBInstance) {
    fileVectorDBInstance = new FileVectorDB();
  }
  return fileVectorDBInstance;
}
