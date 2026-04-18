// 向量数据库抽象接口

import type { DocumentChunk, SearchResult } from './types';

/**
 * 向量数据库抽象接口
 *
 * 所有向量数据库实现都必须实现此接口，确保可以无缝切换
 */
export interface IVectorDatabase {
  /**
   * 初始化数据库
   */
  initialize(): Promise<void>;

  /**
   * 添加文档到Collection
   */
  addDocuments(
    collectionName: string,
    documents: DocumentChunk[]
  ): Promise<void>;

  /**
   * 查询文档（相似度搜索）
   */
  queryDocuments(
    collectionName: string,
    queryEmbedding: number[],
    topK?: number
  ): Promise<SearchResult[]>;

  /**
   * 删除文档
   */
  deleteDocuments(
    collectionName: string,
    ids: string[]
  ): Promise<void>;

  /**
   * 清空Collection
   */
  clearCollection(collectionName: string): Promise<void>;

  /**
   * 获取Collection统计信息
   */
  getCollectionStats(collectionName: string): Promise<{
    count: number;
    name: string;
  }>;

  /**
   * 列出所有Collections
   */
  listCollections(): Promise<string[]>;

  /**
   * 关闭连接
   */
  close(): Promise<void>;
}

/**
 * 向量数据库类型枚举
 */
export enum VectorDBType {
  FILE = 'file',
  CHROMA = 'chroma',
  REDIS = 'redis',
}

/**
 * 创建向量数据库工厂
 */
export function createVectorDB(
  type: VectorDBType = VectorDBType.FILE
): IVectorDatabase {
  switch (type) {
    case VectorDBType.FILE:
      // 动态导入以避免循环依赖
      const { FileVectorDB } = require('./file-vector-db');
      return new FileVectorDB();

    case VectorDBType.CHROMA:
      // TODO: 后续实现
      throw new Error('ChromaDB支持尚未实现，请使用FILE类型');

    case VectorDBType.REDIS:
      // TODO: 后续实现
      throw new Error('Redis支持尚未实现，请使用FILE类型');

    default:
      throw new Error(`未知的向量库类型: ${type}`);
  }
}

/**
 * 获取当前配置的向量数据库实例
 */
export function getVectorDB(): IVectorDatabase {
  const dbType = (process.env.VECTOR_DB_TYPE as VectorDBType) || VectorDBType.FILE;

  if (!global.vectorDBInstance) {
    global.vectorDBInstance = createVectorDB(dbType);
  }

  return global.vectorDBInstance;
}

/**
 * 重置向量数据库实例（用于测试）
 */
export function resetVectorDB(): void {
  global.vectorDBInstance = null;
}

// 扩展全局对象以存储实例
declare global {
  // eslint-disable-next-line no-var
  var vectorDBInstance: IVectorDatabase | null;
}

if (typeof global !== 'undefined') {
  global.vectorDBInstance = null;
}
