// 向量数据库客户端 - 兼容层

import { getVectorDB } from './vector-db-interface';
import type { CollectionConfig, DocumentChunk, SearchResult } from './types';

/**
 * 向量数据库客户端（兼容层）
 *
 * 这个类是对外提供的统一接口，内部根据配置使用不同的实现
 * 当前使用：FileVectorDB（文件缓存）
 */
class VectorDatabase {
  private initialized: boolean = false;

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const db = getVectorDB();
    await db.initialize();

    this.initialized = true;
    console.log('✅ 向量数据库客户端初始化完成');
  }

  /**
   * 获取或创建 Collection
   */
  async getOrCreateCollection(config: CollectionConfig): Promise<void> {
    await this.initialize();
    // FileVectorDB 不需要显式创建Collection，自动处理
  }

  /**
   * 添加文档
   */
  async addDocuments(
    collectionName: string,
    chunks: DocumentChunk[]
  ): Promise<void> {
    await this.initialize();
    const db = getVectorDB();
    await db.addDocuments(collectionName, chunks);
  }

  /**
   * 查询文档
   */
  async queryDocuments(
    collectionName: string,
    queryEmbedding: number[],
    nResults: number = 5
  ): Promise<SearchResult[]> {
    await this.initialize();
    const db = getVectorDB();
    return db.queryDocuments(collectionName, queryEmbedding, nResults);
  }

  /**
   * 删除文档
   */
  async deleteDocuments(
    collectionName: string,
    ids: string[]
  ): Promise<void> {
    await this.initialize();
    const db = getVectorDB();
    await db.deleteDocuments(collectionName, ids);
  }

  /**
   * 清空Collection
   */
  async clearCollection(collectionName: string): Promise<void> {
    await this.initialize();
    const db = getVectorDB();
    await db.clearCollection(collectionName);
  }

  /**
   * 删除Collection
   */
  async deleteCollection(collectionName: string): Promise<void> {
    await this.initialize();
    await this.clearCollection(collectionName);
  }

  /**
   * 获取统计信息
   */
  async getCollectionStats(collectionName: string): Promise<{
    count: number;
    name: string;
  }> {
    await this.initialize();
    const db = getVectorDB();
    return db.getCollectionStats(collectionName);
  }

  /**
   * 列出所有Collections
   */
  async listCollections(): Promise<string[]> {
    await this.initialize();
    const db = getVectorDB();
    return db.listCollections();
  }

  /**
   * 关闭
   */
  async close(): Promise<void> {
    if (this.initialized) {
      const db = getVectorDB();
      await db.close();
      this.initialized = false;
    }
  }
}

// 单例模式
let vectorDBInstance: VectorDatabase | null = null;

/**
 * 获取向量数据库单例
 */
export function getChromaDB(): VectorDatabase {
  if (!vectorDBInstance) {
    vectorDBInstance = new VectorDatabase();
  }
  return vectorDBInstance;
}

/**
 * 重置向量数据库实例（用于测试）
 */
export function resetChromaDB(): void {
  if (vectorDBInstance) {
    vectorDBInstance.close().catch(console.error);
  }
  vectorDBInstance = null;
}
