// 豆包 Embedding 服务
// 使用火山引擎 API（API Key 方式）

export interface EmbeddingResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  data: {
    index: number;
    object: string;
    embedding: number[];
  }[];
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export class DoubaoEmbeddingService {
  private apiKey: string;
  private endpoint: string;
  private model: string;
  private dimensions: number;

  constructor() {
    this.apiKey = process.env.VOLCENGINE_API_KEY || '';
    this.endpoint = process.env.VOLCENGINE_ENDPOINT || 'https://ark.cn-beijing.volces.com';
    this.model = process.env.VOLCENGINE_EMBEDDING_MODEL || 'doubao-embedding-vision-251215';
    this.dimensions = parseInt(process.env.EMBEDDING_DIMENSIONS || '1024', 10);

    // 验证配置
    if (!this.apiKey) {
      throw new Error('豆包 Embedding API 密钥未配置，请检查环境变量');
    }
  }

  /**
   * 生成单个文本的向量
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      console.log(`[DoubaoEmbedding] 生成向量，文本长度: ${text.length}`);

      // 使用多模态 Embedding API 端点
      const body = JSON.stringify({
        model: this.model,
        input: [
          {
            type: "text",
            text: text
          }
        ]
      });

      const url = `${this.endpoint}/api/v3/embeddings/multimodal`;
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      };

      console.log('[DoubaoEmbedding] 发送请求...');
      console.log('  - URL:', url);
      console.log('  - Model:', this.model);
      console.log('  - API Key:', this.apiKey);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[DoubaoEmbedding] API 错误:', errorText);
        throw new Error(`豆包 Embedding API 请求失败: ${response.status} ${errorText}`);
      }

      const data: any = await response.json();

      // 多模态 API 返回格式不同
      if (!data.data || !data.data.embedding) {
        throw new Error('豆包 Embedding API 返回空数据');
      }

      const embedding = data.data.embedding;
      console.log(`[DoubaoEmbedding] 向量生成成功，维度: ${embedding.length}`);

      return embedding;
    } catch (error) {
      console.error('[DoubaoEmbedding] 生成向量失败:', error);
      throw error;
    }
  }

  /**
   * 批量生成向量
   */
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      console.log(`[DoubaoEmbedding] 批量生成向量，数量: ${texts.length}`);

      // 多模态 Embedding API 每次只能处理一个输入
      // 所以需要逐个生成向量
      const embeddings: number[][] = [];

      for (let i = 0; i < texts.length; i++) {
        console.log(`[DoubaoEmbedding] 处理第 ${i + 1}/${texts.length} 个文本`);
        const embedding = await this.generateEmbedding(texts[i]);
        embeddings.push(embedding);
      }

      console.log(`[DoubaoEmbedding] 批量向量生成成功，数量: ${embeddings.length}`);

      return embeddings;
    } catch (error) {
      console.error('[DoubaoEmbedding] 批量生成向量失败:', error);
      throw error;
    }
  }

  /**
   * 获取向量维度
   */
  getDimensions(): number {
    return this.dimensions;
  }

  /**
   * 获取模型名称
   */
  getModel(): string {
    return this.model;
  }
}

// 单例模式
let embeddingServiceInstance: DoubaoEmbeddingService | null = null;

export function getDoubaoEmbeddingService(): DoubaoEmbeddingService {
  if (!embeddingServiceInstance) {
    embeddingServiceInstance = new DoubaoEmbeddingService();
  }
  return embeddingServiceInstance;
}

/**
 * 生成向量（便捷函数）
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const service = getDoubaoEmbeddingService();
  return service.generateEmbedding(text);
}

/**
 * 批量生成向量（便捷函数）
 */
export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const service = getDoubaoEmbeddingService();
  return service.generateBatchEmbeddings(texts);
}
