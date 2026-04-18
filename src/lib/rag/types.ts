// RAG 系统类型定义

export interface DocumentChunk {
  id: string;
  text: string;
  metadata: {
    source?: string;
    title?: string;
    division?: string;
    platform?: string;
    category?: string;
    [key: string]: any;
  };
  embedding?: number[];
}

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
  distance?: number;
}

export interface CollectionConfig {
  name: string;
  embeddingDimension?: number;
  metadata?: Record<string, any>;
}

export interface EmbeddingOptions {
  dimensions?: number;
  model?: string;
}

export interface KnowledgeBaseStats {
  totalDocuments: number;
  totalChunks: number;
  collections: string[];
  lastUpdated: Date;
}
