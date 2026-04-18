// RAG 集成核心模块
// 提供智能检索和上下文增强能力

import { getChromaDB } from './chroma-client';
import { queryAnalyzer } from './query-analyzer';
import { contextBuilder } from './context-builder';
import { generateEmbedding } from '@/lib/embedding/doubao-embedding';

export interface RAGConfig {
  enabled: boolean;
  minScore: number;
  topK: number;
  maxContextLength: number;
}

export interface RAGResult {
  success: boolean;
  used: boolean;
  context: string;
  metadata: {
    collectionName: string;
    retrievalCount: number;
    avgScore: number;
    queryTime: number;
  };
}

/**
 * RAG 集成服务
 */
export class RAGIntegration {
  private config: RAGConfig;
  private chromaDB: any;

  constructor(config?: Partial<RAGConfig>) {
    this.config = {
      enabled: true,
      minScore: 0.5,
      topK: 5,
      maxContextLength: 2000,
      ...config,
    };
    this.chromaDB = getChromaDB();
  }

  /**
   * 增强用户查询
   */
  async enhanceQuery(
    query: string,
    agentId: string,
    options?: {
      forceRAG?: boolean;
      customCollection?: string;
    }
  ): Promise<RAGResult> {
    const startTime = Date.now();

    console.log(`[RAG] 开始增强查询，agentId: ${agentId}, query: ${query.substring(0, 50)}...`);

    // 检查 RAG 是否启用
    if (!this.config.enabled && !options?.forceRAG) {
      console.log(`[RAG] RAG 未启用，跳过检索`);
      return {
        success: true,
        used: false,
        context: '',
        metadata: {
          collectionName: 'none',
          retrievalCount: 0,
          avgScore: 0,
          queryTime: 0,
        },
      };
    }

    // 分析问题类型
    const analysis = await queryAnalyzer.analyze(query, agentId);

    console.log(`[RAG] 问题分析结果:`, {
      needsRAG: analysis.needsRAG,
      collectionName: analysis.collectionName,
      confidence: analysis.confidence,
      keywords: analysis.keywords,
    });

    // 如果不需要 RAG，直接返回
    if (!analysis.needsRAG && !options?.forceRAG) {
      console.log(`[RAG] 问题不需要 RAG，跳过检索`);
      return {
        success: true,
        used: false,
        context: '',
        metadata: {
          collectionName: 'none',
          retrievalCount: 0,
          avgScore: 0,
          queryTime: Date.now() - startTime,
        },
      };
    }

    // 确定知识库
    const collectionName = options?.customCollection || analysis.collectionName;

    console.log(`[RAG] 开始检索知识库: ${collectionName}`);

    // 检索相关文档
    try {
      // 为查询文本生成向量
      console.log(`[RAG] 正在生成查询向量...`);
      const queryEmbedding = await generateEmbedding(query);
      console.log(`[RAG] 查询向量生成成功，维度: ${queryEmbedding.length}`);

      // 使用向量进行检索
      const retrievalResult = await this.chromaDB.queryDocuments(
        collectionName,
        queryEmbedding,
        this.config.topK
      );

      console.log(`[RAG] 检索完成，找到 ${retrievalResult.length} 个结果`);

      // 过滤低分结果
      const filteredDocs = retrievalResult
        .filter((item: any) => item.score >= this.config.minScore)
        .map((item: any) => ({
          text: item.text,
          metadata: item.metadata || {},
          score: item.score,
        }));

      console.log(`[RAG] 过滤后保留 ${filteredDocs.length} 个结果（minScore: ${this.config.minScore}）`);

      if (filteredDocs.length === 0) {
        return {
          success: true,
          used: true,
          context: '',
          metadata: {
            collectionName,
            retrievalCount: 0,
            avgScore: 0,
            queryTime: Date.now() - startTime,
          },
        };
      }

      // 构建上下文
      const context = contextBuilder.build(filteredDocs, {
        maxTokens: this.config.maxContextLength,
        format: 'detailed', // 'detailed' | 'concise' | 'summary'
      });

      console.log(`[RAG] 上下文构建完成，长度: ${context.length} 字符`);

      // 计算平均分数
      const avgScore = filteredDocs.reduce((sum: number, item: any) => sum + item.score, 0) / filteredDocs.length;

      return {
        success: true,
        used: true,
        context,
        metadata: {
          collectionName,
          retrievalCount: filteredDocs.length,
          avgScore: parseFloat(avgScore.toFixed(3)),
          queryTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      console.error(`[RAG] 检索失败:`, error);
      // 检索失败时返回未使用状态，不影响正常流程
      return {
        success: false,
        used: false,
        context: '',
        metadata: {
          collectionName,
          retrievalCount: 0,
          avgScore: 0,
          queryTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * 检查知识库状态
   */
  async checkKnowledgeBase(collectionName: string): Promise<{
    available: boolean;
    documentCount: number;
  }> {
    try {
      const stats = await this.chromaDB.getCollectionStats(collectionName);
      return {
        available: true,
        documentCount: stats.count,
      };
    } catch (error) {
      console.error(`[RAG] 检查知识库失败:`, error);
      return {
        available: false,
        documentCount: 0,
      };
    }
  }

  /**
   * 获取配置
   */
  getConfig(): RAGConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<RAGConfig>): void {
    this.config = { ...this.config, ...config };
    console.log(`[RAG] 配置已更新:`, this.config);
  }
}

// 单例
let ragIntegrationInstance: RAGIntegration | null = null;

export function getRAGIntegration(): RAGIntegration {
  if (!ragIntegrationInstance) {
    ragIntegrationInstance = new RAGIntegration();
  }
  return ragIntegrationInstance;
}

/**
 * 增强查询（便捷函数）
 */
export async function enhanceQuery(
  query: string,
  agentId: string,
  options?: {
    forceRAG?: boolean;
    customCollection?: string;
  }
): Promise<RAGResult> {
  const service = getRAGIntegration();
  return service.enhanceQuery(query, agentId, options);
}
