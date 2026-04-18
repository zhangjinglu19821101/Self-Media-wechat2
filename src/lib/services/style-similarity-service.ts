/**
 * 风格相似度评估服务 (StyleSimilarityService)
 *
 * Phase 5 PoC — 基于向量嵌入的风格相似度计算
 *
 * 能力：
 * 1. 文章风格嵌入 — 将文章文本转换为高维向量表示
 * 2. 风格相似度比较 — 计算两篇文章的语义风格相似度
 * 3. 风格一致性评分 — 对比新文章与历史标杆文章的风格偏离程度
 *
 * 技术方案：
 * - 使用 coze-coding-dev-sdk 的 EmbeddingClient
 * - 默认模型: doubao-embedding-vision-251215
 * - 相似度算法: 余弦相似度 (Cosine Similarity)
 * - 维度: 默认 1024（可配置）
 *
 * 设计约束：
 * - PoC 级别：当前不持久化向量，按需实时计算
 * - 超时控制：单次嵌入 15 秒
 * - 失败降级：返回 0.0（无相似度信息）而非阻塞
 */

import { EmbeddingClient } from 'coze-coding-dev-sdk';
import { createUserEmbeddingClient, getPlatformEmbedding } from '@/lib/llm/factory';

// ========== 类型定义 ==========

/** 风格相似度结果 */
export interface StyleSimilarityResult {
  /** 余弦相似度分数 0~1（1=完全一致） */
  similarityScore: number;
  /** 相似度等级 */
  level: 'identical' | 'high' | 'medium' | 'low' | 'divergent';
  /** 向量维度 */
  dimension: number;
  /** 详细分析 */
  analysis: {
    /** 比较的文章1摘要 */
    text1Preview: string;
    /** 比较的文章2摘要 */
    text2Preview: string;
    /** 计算耗时(ms) */
    elapsedMs: number;
  };
}

/** 风格一致性评估结果（多标杆对比） */
export interface StyleConsistencyResult {
  /** 与各标杆的平均相似度 */
  averageSimilarity: number;
  /** 与最近标杆的相似度 */
  maxSimilarity: number;
  /** 与最远标杆的相似度 */
  minSimilarity: number;
  /** 一致性等级 */
  consistencyLevel: 'excellent' | 'good' | 'acceptable' | 'needs_improvement';
  /** 各标杆对比详情 */
  comparisons: Array<{
    benchmarkName: string;
    similarity: number;
    level: StyleSimilarityResult['level'];
  }>;
  /** 总体建议 */
  suggestion: string;
}

// ========== 常量 ==========

/** 相似度阈值定义 */
const SIMILARITY_THRESHOLDS = {
  identical: 0.95,   // 几乎相同
  high: 0.80,       // 高度相似
  medium: 0.60,     // 中等相似
  low: 0.35,        // 低相似
} as const;

/** 一致性阈值 */
const CONSISTENCY_THRESHOLDS = {
  excellent: 0.85,
  good: 0.70,
  acceptable: 0.50,
} as const;

/** 默认嵌入维度 */
const DEFAULT_EMBEDDING_DIMENSION = 1024;

/** 单次嵌入超时(ms) */
const EMBEDDING_TIMEOUT = 15000;

// ========== 服务类 ==========

export class StyleSimilarityService {
  private static instance: StyleSimilarityService | null = null;

  static getInstance(): StyleSimilarityService {
    if (!StyleSimilarityService.instance) {
      StyleSimilarityService.instance = new StyleSimilarityService();
    }
    return StyleSimilarityService.instance;
  }

  private client: EmbeddingClient;

  constructor() {
    this.client = new EmbeddingClient();
  }

  /**
   * 获取 Embedding 客户端（按 workspace llmKeySource 策略）
   * 无 workspaceId 时直接使用平台 Key（后台任务场景）
   */
  private async getClient(workspaceId?: string): Promise<EmbeddingClient> {
    if (workspaceId) {
      const { client } = await createUserEmbeddingClient(workspaceId);
      return client;
    }
    return getPlatformEmbedding();
  }

  // ================================================================
  // 核心能力1：两篇文章风格相似度
  // ================================================================

  /**
   * 计算两篇文章的风格相似度
   *
   * 流程：
   * 1. 预处理文本（去除HTML、截断到合理长度）
   * 2. 分别调用 Embedding API 获取向量
   * 3. 计算余弦相似度
   * 4. 映射为相似度等级
   *
   * @param articleText1 - 第一篇文章纯文本
   * @param articleText2 - 第二篇文章纯文本
   * @param options - 可选配置
   * @returns 风格相似度结果
   */
  async compareStyle(
    articleText1: string,
    articleText2: string,
    options?: { dimension?: number; workspaceId?: string }
  ): Promise<StyleSimilarityResult> {
    const startTime = Date.now();
    const dimension = options?.dimension || DEFAULT_EMBEDDING_DIMENSION;
    const client = await this.getClient(options?.workspaceId);

    // 预处理
    const processed1 = this.preprocessText(articleText1);
    const processed2 = this.preprocessText(articleText2);

    console.log('[StyleSimilarity] 开始风格相似度比较', {
      text1Length: processed1.length,
      text2Length: processed2.length,
      dimension,
    });

    try {
      // 并行获取两个嵌入向量
      const [embedding1, embedding2] = await Promise.all([
        this.embedWithTimeout(processed1, dimension, client),
        this.embedWithTimeout(processed2, dimension, client),
      ]);

      // 计算余弦相似度
      const score = this.cosineSimilarity(embedding1, embedding2);
      const level = this.mapScoreToLevel(score);

      const result: StyleSimilarityResult = {
        similarityScore: Math.round(score * 10000) / 10000,
        level,
        dimension: embedding1.length,
        analysis: {
          text1Preview: processed1.substring(0, 80) + (processed1.length > 80 ? '...' : ''),
          text2Preview: processed2.substring(0, 80) + (processed2.length > 80 ? '...' : ''),
          elapsedMs: Date.now() - startTime,
        },
      };

      console.log('[StyleSimilarity] 风格相似度比较完成', {
        score: result.similarityScore,
        level,
        elapsedMs: result.analysis.elapsedMs,
      });

      return result;

    } catch (error) {
      console.error('[StyleSimilarity] 风格相似度比较失败:', error instanceof Error ? error.message : String(error));

      return {
        similarityScore: 0,
        level: 'divergent',
        dimension: 0,
        analysis: {
          text1Preview: processed1.substring(0, 80),
          text2Preview: processed2.substring(0, 80),
          elapsedMs: Date.now() - startTime,
        },
      };
    }
  }

  // ================================================================
  // 核心能力2：风格一致性评估（与多个标杆对比）
  // ================================================================

  /**
   * 评估新文章与一组标杆文章的风格一致性
   *
   * 用途：
   * - 新文章产出后，检查是否偏离用户期望的风格
   * - 多篇标杆取平均，避免单篇偏差
   *
   * @param newArticle - 新产出的文章
   * @param benchmarks - 标杆文章列表（可以是历史高质量文章）
   * @param options - 可选配置
   * @returns 风格一致性结果
   */
  async evaluateConsistency(
    newArticle: string,
    benchmarks: Array<{ name: string; content: string }>,
    options?: { dimension?: number; workspaceId?: string }
  ): Promise<StyleConsistencyResult> {
    const startTime = Date.now();
    const dimension = options?.dimension || DEFAULT_EMBEDDING_DIMENSION;
    const client = await this.getClient(options?.workspaceId);

    if (!benchmarks || benchmarks.length === 0) {
      return {
        averageSimilarity: 0,
        maxSimilarity: 0,
        minSimilarity: 0,
        consistencyLevel: 'needs_improvement',
        comparisons: [],
        suggestion: '无标杆文章可供对比',
      };
    }

    console.log('[StyleSimilarity] 开始风格一致性评估', {
      newArticleLength: newArticle.length,
      benchmarkCount: benchmarks.length,
    });

    try {
      const processedNew = this.preprocessText(newArticle);

      // 并行嵌入新文章和所有标杆
      const newEmbedding = await this.embedWithTimeout(processedNew, dimension, client);
      const benchmarkEmbeddings = await Promise.all(
        benchmarks.map(b => this.embedWithTimeout(this.preprocessText(b.content), dimension, client))
      );

      // 逐个计算相似度
      const comparisons = benchmarks.map((b, i) => {
        const score = this.cosineSimilarity(newEmbedding, benchmarkEmbeddings[i]);
        return {
          benchmarkName: b.name,
          similarity: Math.round(score * 10000) / 10000,
          level: this.mapScoreToLevel(score),
        };
      });

      // 统计
      const similarities = comparisons.map(c => c.similarity);
      const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
      const maxSim = Math.max(...similarities);
      const minSim = Math.min(...similarities);

      // 确定一致性等级
      let consistencyLevel: StyleConsistencyResult['consistencyLevel'];
      if (avgSimilarity >= CONSISTENCY_THRESHOLDS.excellent) {
        consistencyLevel = 'excellent';
      } else if (avgSimilarity >= CONSISTENCY_THRESHOLDS.good) {
        consistencyLevel = 'good';
      } else if (avgSimilarity >= CONSISTENCY_THRESHOLDS.acceptable) {
        consistencyLevel = 'acceptable';
      } else {
        consistencyLevel = 'needs_improvement';
      }

      // 生成建议
      const suggestion = this.generateConsistencySuggestion(
        consistencyLevel, avgSimilarity, maxSim, minSim
      );

      const result: StyleConsistencyResult = {
        averageSimilarity: Math.round(avgSimilarity * 10000) / 10000,
        maxSimilarity: Math.round(maxSim * 10000) / 10000,
        minSimilarity: Math.round(minSim * 10000) / 10000,
        consistencyLevel,
        comparisons,
        suggestion,
      };

      console.log('[StyleSimilarity] 风格一致性评估完成', {
        ...result,
        elapsedMs: Date.now() - startTime,
      });

      return result;

    } catch (error) {
      console.error('[StyleSimilarity] 风格一致性评估失败:', error instanceof Error ? error.message : String(error));
      return {
        averageSimilarity: 0,
        maxSimilarity: 0,
        minSimilarity: 0,
        consistencyLevel: 'needs_improvement',
        comparisons: [],
        suggestion: `评估失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // ================================================================
  // 辅助能力：仅获取嵌入向量（供外部使用）
  // ================================================================

  /**
   * 获取文本的嵌入向量
   *
   * @param text - 输入文本
   * @param dimension - 向量维度（默认1024）
   * @returns 嵌入向量数组
   */
  async getEmbedding(text: string, dimension?: number): Promise<number[]> {
    const processed = this.preprocessText(text);
    return this.embedWithTimeout(processed, dimension || DEFAULT_EMBEDDING_DIMENSION);
  }

  /**
   * 批量获取嵌入向量
   *
   * @param texts - 文本列表
   * @param dimension - 向量维度
   * @returns 嵌入向量数组列表
   */
  async getBatchEmbeddings(texts: string[], dimension?: number): Promise<number[][]> {
    const processed = texts.map(t => this.preprocessText(t));
    return Promise.all(processed.map(t => this.embedWithTimeout(t, dimension || DEFAULT_EMBEDDING_DIMENSION)));
  }

  // ================================================================
  // 工具方法
  // ================================================================

  /**
   * 预处理文本：去除 HTML、截断、清理空白
   */
  private preprocessText(text: string): string {
    return text
      .replace(/<[^>]+>/g, '')           // 去除 HTML 标签
      .replace(/&nbsp;/g, ' ')            // 替换空格实体
      .replace(/&[a-z]+;/gi, '')         // 移除其他实体
      .replace(/\s+/g, ' ')              // 合并空白
      .trim()
      .substring(0, 6000);               // 截断到合理长度（控制 token 消耗）
  }

  /**
   * 带超时的嵌入调用
   */
  private async embedWithTimeout(text: string, dimension: number, client?: EmbeddingClient): Promise<number[]> {
    const embeddingClient = client || this.client;
    return Promise.race([
      embeddingClient.embedText(text, { dimensions: dimension }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Embedding timeout after ${EMBEDDING_TIMEOUT}ms`)), EMBEDDING_TIMEOUT)
      ),
    ]);
  }

  /**
   * 余弦相似度计算
   *
   * cos(A,B) = (A·B) / (||A|| × ||B||)
   * 返回值范围 [-1, 1]，对于同向文本通常在 [0, 1]
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  /**
   * 将相似度分数映射为等级
   */
  private mapScoreToLevel(score: number): StyleSimilarityResult['level'] {
    if (score >= SIMILARITY_THRESHOLDS.identical) return 'identical';
    if (score >= SIMILARITY_THRESHOLDS.high) return 'high';
    if (score >= SIMILARITY_THRESHOLDS.medium) return 'medium';
    if (score >= SIMILARITY_THRESHOLDS.low) return 'low';
    return 'divergent';
  }

  /**
   * 生成一致性建议
   */
  private generateConsistencySuggestion(
    level: StyleConsistencyResult['consistencyLevel'],
    avg: number,
    max: number,
    min: number
  ): string {
    switch (level) {
      case 'excellent':
        return `文章风格与标杆高度一致（平均${(avg * 100).toFixed(1)}%），保持当前写作风格`;
      case 'good':
        return `文章风格基本符合标杆特征（平均${(avg * 100).toFixed(1)}%），整体良好`;
      case 'acceptable':
        return `文章风格存在一定偏离（平均${(avg * 100).toFixed(1)}%），建议参考最接近的标杆（${(max * 100).toFixed(1)}%）调整语气和用词`;
      case 'needs_improvement':
        return `文章风格与标杆差异较大（平均${(avg * 100).toFixed(1)}%），建议重新审视语气、句式和用词习惯，使其更贴近目标风格`;
      default:
        return '';
    }
  }
}

// ========== 导出单例实例 ==========
export const styleSimilarityService = StyleSimilarityService.getInstance();
