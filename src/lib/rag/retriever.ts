// RAG 检索器 - 向量相似度搜索

import { getChromaDB } from './chroma-client';
import { RAG_CONFIG } from './config';
import { generateEmbedding } from '@/lib/embedding/doubao-embedding';
import type { SearchResult, DocumentChunk } from './types';

export interface RetrievalOptions {
  collectionName?: string;
  topK?: number;
  minScore?: number;
  filter?: Record<string, any>;
}

export interface RetrievalResult {
  query: string;
  results: SearchResult[];
  count: number;
  collectionName: string;
}

export class VectorRetriever {
  private defaultCollectionName: string;

  constructor(collectionName: string = RAG_CONFIG.defaultCollection) {
    this.defaultCollectionName = collectionName;
  }

  /**
   * 执行检索
   */
  async retrieve(
    query: string,
    options: RetrievalOptions = {}
  ): Promise<RetrievalResult> {
    const collectionName = options.collectionName || this.defaultCollectionName;
    const topK = options.topK || RAG_CONFIG.retrieval.topK;
    const minScore = options.minScore || RAG_CONFIG.retrieval.minScore;

    // 为查询文本生成向量
    const queryEmbedding = await generateEmbedding(query);

    const chromaDB = getChromaDB();
    const results = await chromaDB.queryDocuments(collectionName, queryEmbedding, topK);

    // 过滤结果（如果设置了最小分数）
    const filteredResults = results.filter(r => r.score >= minScore);

    return {
      query,
      results: filteredResults,
      count: filteredResults.length,
      collectionName,
    };
  }

  /**
   * 多查询检索
   */
  async retrieveMultiple(
    queries: string[],
    options: RetrievalOptions = {}
  ): Promise<RetrievalResult[]> {
    const collectionName = options.collectionName || this.defaultCollectionName;
    const topK = options.topK || RAG_CONFIG.retrieval.topK;
    const minScore = options.minScore || RAG_CONFIG.retrieval.minScore;

    const chromaDB = getChromaDB();
    const results = await chromaDB.queryDocuments(collectionName, queries, topK);

    // 每个查询的结果
    const retrievalResults: RetrievalResult[] = queries.map((query, index) => {
      const queryResults = results.filter(
        r => r.score >= minScore && results.indexOf(r) % queries.length === index
      );

      return {
        query,
        results: queryResults,
        count: queryResults.length,
        collectionName,
      };
    });

    return retrievalResults;
  }

  /**
   * 语义搜索（基于用户查询）
   */
  async semanticSearch(
    query: string,
    options: RetrievalOptions = {}
  ): Promise<SearchResult[]> {
    const result = await this.retrieve(query, options);
    return result.results;
  }

  /**
   * 上下文检索 - 用于 RAG
   */
  async retrieveContext(
    query: string,
    options: RetrievalOptions = {}
  ): Promise<string> {
    const topK = options.topK || RAG_CONFIG.retrieval.topK;
    const minScore = options.minScore || RAG_CONFIG.retrieval.minScore;

    const results = await this.retrieve(query, {
      ...options,
      topK,
      minScore,
    });

    if (results.results.length === 0) {
      return '';
    }

    // 将检索结果拼接成上下文
    const context = results.results
      .map((result, index) => {
        return `[文档片段 ${index + 1} (相似度: ${result.score.toFixed(4)})]\n${result.chunk.text}\n`;
      })
      .join('\n');

    return context;
  }

  /**
   * 相关文档推荐
   */
  async recommendRelated(
    documentId: string,
    options: RetrievalOptions = {}
  ): Promise<SearchResult[]> {
    // 获取文档内容
    const chromaDB = getChromaDB();
    const collection = await chromaDB['getOrCreateCollection']({ name: options.collectionName || this.defaultCollectionName });
    const data = await collection.get({ ids: [documentId] });

    if (!data.documents || data.documents.length === 0) {
      return [];
    }

    const documentText = data.documents[0] || '';

    if (!documentText) {
      return [];
    }

    // 使用文档文本进行检索
    return this.semanticSearch(documentText, options);
  }

  /**
   * 混合检索（关键词 + 语义）
   */
  async hybridSearch(
    query: string,
    keywords: string[],
    options: RetrievalOptions = {}
  ): Promise<SearchResult[]> {
    // 先进行语义检索
    const semanticResults = await this.retrieve(query, options);

    // 过滤包含关键词的结果
    const keywordFiltered = semanticResults.results.filter(result => {
      const text = result.chunk.text.toLowerCase();
      return keywords.some(keyword => text.includes(keyword.toLowerCase()));
    });

    // 如果关键词过滤后结果太少，返回语义检索结果
    if (keywordFiltered.length < 2 && semanticResults.results.length > 0) {
      return semanticResults.results;
    }

    return keywordFiltered;
  }
}

/**
 * 创建默认的检索器
 */
export function createVectorRetriever(
  collectionName?: string
): VectorRetriever {
  return new VectorRetriever(collectionName);
}
