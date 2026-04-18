/**
 * 知识库（记忆）管理器
 * 负责管理 Agent 的记忆，支持文档导入和向量搜索
 */

import {
  KnowledgeClient,
  Config,
  KnowledgeDocument,
  DataSourceType,
  ChunkConfig,
} from 'coze-coding-dev-sdk';

export class KnowledgeBaseManager {
  private client: KnowledgeClient;
  private datasetName: string;

  constructor(datasetName: string = 'agent_memory') {
    const config = new Config();
    this.client = new KnowledgeClient(config);
    this.datasetName = datasetName;
  }

  /**
   * 导入文本到知识库
   */
  async importText(
    text: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; docId?: string; error?: string }> {
    try {
      const document: KnowledgeDocument = {
        source: DataSourceType.TEXT,
        raw_data: text,
      };

      // 添加元数据到文本中
      if (metadata) {
        document.raw_data = `[METADATA: ${JSON.stringify(metadata)}]\n\n${text}`;
      }

      const response = await this.client.addDocuments([document], this.datasetName);

      if (response.code === 0 && response.doc_ids && response.doc_ids.length > 0) {
        return {
          success: true,
          docId: response.doc_ids[0],
        };
      } else {
        return {
          success: false,
          error: response.msg || '导入失败',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 导入 URL 到知识库
   */
  async importUrl(
    url: string,
    metadata?: Record<string, any>
  ): Promise<{ success: boolean; docId?: string; error?: string }> {
    try {
      const document: KnowledgeDocument = {
        source: DataSourceType.URL,
        url: url,
      };

      // 添加元数据
      if (metadata) {
        // URL 不能直接添加元数据，我们创建一个辅助文本文档
        const metaDoc: KnowledgeDocument = {
          source: DataSourceType.TEXT,
          raw_data: `[METADATA: ${JSON.stringify(metadata)}]\n\n来源URL: ${url}`,
        };

        const response = await this.client.addDocuments(
          [document, metaDoc],
          this.datasetName
        );

        if (response.code === 0 && response.doc_ids && response.doc_ids.length > 0) {
          return {
            success: true,
            docId: response.doc_ids[0],
          };
        } else {
          return {
            success: false,
            error: response.msg || '导入失败',
          };
        }
      }

      const response = await this.client.addDocuments([document], this.datasetName);

      if (response.code === 0 && response.doc_ids && response.doc_ids.length > 0) {
        return {
          success: true,
          docId: response.doc_ids[0],
        };
      } else {
        return {
          success: false,
          error: response.msg || '导入失败',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 搜索知识库
   */
  async search(
    query: string,
    topK: number = 5,
    minScore: number = 0.0
  ): Promise<{
    success: boolean;
    results?: Array<{ content: string; score: number; docId: string }>;
    error?: string;
  }> {
    try {
      const response = await this.client.search(query, [this.datasetName], topK, minScore);

      if (response.code === 0 && response.chunks) {
        const results = response.chunks.map((chunk) => ({
          content: chunk.content,
          score: chunk.score,
          docId: chunk.doc_id,
        }));

        return {
          success: true,
          results,
        };
      } else {
        return {
          success: false,
          error: response.msg || '搜索失败',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 为 Agent 添加记忆
   */
  async addAgentMemory(
    agentId: string,
    memory: string,
    type: 'experience' | 'knowledge' | 'history' = 'experience'
  ): Promise<{ success: boolean; docId?: string; error?: string }> {
    const metadata = {
      agentId,
      type,
      timestamp: new Date().toISOString(),
    };

    return this.importText(memory, metadata);
  }

  /**
   * 搜索 Agent 的记忆
   */
  async searchAgentMemory(
    agentId: string,
    query: string,
    type?: 'experience' | 'knowledge' | 'history'
  ): Promise<{
    success: boolean;
    results?: Array<{ content: string; score: number; docId: string }>;
    error?: string;
  }> {
    const searchResults = await this.search(query, 10, 0.0);

    if (!searchResults.success || !searchResults.results) {
      return searchResults;
    }

    // 过滤结果，只返回属于指定 Agent 的记忆
    const filteredResults = searchResults.results.filter((result) => {
      const metaMatch = result.content.match(/\[METADATA: (.+?)\]/);
      if (metaMatch) {
        try {
          const metadata = JSON.parse(metaMatch[1]);
          return metadata.agentId === agentId && (!type || metadata.type === type);
        } catch {
          return false;
        }
      }
      return false;
    });

    return {
      success: true,
      results: filteredResults,
    };
  }

  /**
   * 获取 Agent 的所有记忆摘要
   */
  async getAgentMemorySummary(
    agentId: string
  ): Promise<{
    success: boolean;
    summary?: { experience: number; knowledge: number; history: number };
    error?: string;
  }> {
    // 搜索该 Agent 的所有记忆
    const results = await this.searchAgentMemory(agentId, agentId);

    if (!results.success) {
      return results;
    }

    // 统计不同类型的记忆数量
    const summary = {
      experience: 0,
      knowledge: 0,
      history: 0,
    };

    results.results?.forEach((result) => {
      const metaMatch = result.content.match(/\[METADATA: (.+?)\]/);
      if (metaMatch) {
        try {
          const metadata = JSON.parse(metaMatch[1]);
          summary[metadata.type as keyof typeof summary]++;
        } catch {
          // ignore parse errors
        }
      }
    });

    return {
      success: true,
      summary,
    };
  }
}

// 导出单例
export const knowledgeBaseManager = new KnowledgeBaseManager('agent_memory');

// 为每个 Agent 创建独立的知识库实例
export const agentKnowledgeBase: Record<string, KnowledgeBaseManager> = {
  A: new KnowledgeBaseManager('agent_A_memory'),
  B: new KnowledgeBaseManager('agent_B_memory'),
  C: new KnowledgeBaseManager('agent_C_memory'),
  D: new KnowledgeBaseManager('agent_D_memory'),
  'insurance-c': new KnowledgeBaseManager('agent_insurance_c_memory'),
  'insurance-d': new KnowledgeBaseManager('agent_insurance_d_memory'),
};
