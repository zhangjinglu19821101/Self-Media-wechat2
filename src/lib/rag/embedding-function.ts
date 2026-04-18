// 自定义 Embedding 函数 - 桥接 Chroma 和 coze-coding-dev-sdk
// BYOK: 支持 workspaceId 参数，优先使用用户 API Key

import { EmbeddingClient } from 'coze-coding-dev-sdk';
import { createUserEmbeddingClient, getPlatformEmbedding } from '@/lib/llm/factory';
import type { EmbeddingFunction } from 'chromadb';

export class CozeEmbeddingFunction implements EmbeddingFunction {
  private client: EmbeddingClient;
  private dimensions: number;
  private model: string;
  private workspaceId?: string;

  constructor({
    dimensions = 1024,
    model = 'doubao-embedding-vision-251215',
    workspaceId,
  }: {
    dimensions?: number;
    model?: string;
    workspaceId?: string; // BYOK: 传入 workspaceId 以使用用户 API Key
  } = {}) {
    this.client = new EmbeddingClient();
    this.dimensions = dimensions;
    this.model = model;
    this.workspaceId = workspaceId;
  }

  /**
   * 获取 Embedding 客户端（按 workspace llmKeySource 策略）
   * 无 workspaceId 时使用平台 Key
   */
  private async getClient(): Promise<EmbeddingClient> {
    if (this.workspaceId) {
      const { client } = await createUserEmbeddingClient(this.workspaceId);
      return client;
    }
    return this.client;
  }

  /**
   * 将文本列表转换为向量列表
   */
  public async generate(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    const client = await this.getClient();

    for (const text of texts) {
      try {
        const embedding = await client.embedText(text, {
          dimensions: this.dimensions,
          model: this.model,
        });
        embeddings.push(embedding);
      } catch (error) {
        console.error(`Error embedding text: ${text}`, error);
        // 如果出错，返回零向量
        embeddings.push(new Array(this.dimensions).fill(0));
      }
    }

    return embeddings;
  }

  /**
   * 获取 Embedding 维度
   */
  public getDimension(): number {
    return this.dimensions;
  }

  /**
   * 获取模型名称
   */
  public getModel(): string {
    return this.model;
  }
}

/**
 * 创建默认的 Coze Embedding 函数
 * @param options.dimensions 嵌入维度
 * @param options.model 嵌入模型
 * @param options.workspaceId BYOK: 传入 workspaceId 以使用用户 API Key
 */
export function createCozeEmbeddingFunction(options?: {
  dimensions?: number;
  model?: string;
  workspaceId?: string;
}): CozeEmbeddingFunction {
  return new CozeEmbeddingFunction(options);
}
