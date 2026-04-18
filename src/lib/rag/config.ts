// RAG 系统配置

export const RAG_CONFIG = {
  // Chroma 存储路径
  chromaStoragePath: process.env.CHROMA_STORAGE_PATH || './data/chroma',

  // 默认 Embedding 配置
  embedding: {
    model: 'doubao-embedding-vision-251215',
    dimensions: 1024,
  },

  // 向量检索配置
  retrieval: {
    topK: 5, // 默认返回前5个最相关的文档
    minScore: 0.6, // 最小相似度分数
  },

  // 文档分块配置
  chunking: {
    maxChunkSize: 500, // 每个chunk最大字符数
    chunkOverlap: 50, // chunk之间的重叠字符数
  },

  // 默认 Collection 名称
  defaultCollection: 'knowledge_base',

  // 支持的 Collection
  collections: {
    knowledge_base: {
      name: 'knowledge_base',
      embeddingDimension: 1024,
    },
    insurance_knowledge: {
      name: 'insurance_knowledge',
      embeddingDimension: 1024,
    },
    ai_knowledge: {
      name: 'ai_knowledge',
      embeddingDimension: 1024,
    },
  },
} as const;

export type RAGConfig = typeof RAG_CONFIG;
