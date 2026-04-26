/**
 * 统一搜索服务 - 类型定义
 */

/** 搜索模式 */
export type SearchMode = 'auto' | 'local_only' | 'web_only';

/** 权威站点领域 */
export type DomainKey =
  | 'regulatory'   // 监管机构
  | 'media'        // 官方媒体
  | 'finance'      // 财经媒体
  | 'insurance'    // 保险行业
  | 'law'          // 法律法规
  | 'knowledge'    // 知识百科
  | 'data';        // 统计数据

/** 统一搜索请求 */
export interface UnifiedSearchRequest {
  /** 搜索关键词 */
  query: string;
  /** 搜索模式，默认 auto */
  mode?: SearchMode;
  /** 限定领域 */
  domains?: DomainKey[];
  /** 返回数量，默认 5 */
  limit?: number;
  /** 是否需要 LLM 概括，默认 true */
  needSummary?: boolean;
  /** 互联网结果是否自动存入素材库，默认 false */
  autoSaveToMaterial?: boolean;
  /** 上下文信息（文章编辑场景用） */
  context?: {
    articleContent?: string;
    cursorPosition?: number;
    surroundingText?: string;
  };
}

/** 本地搜索结果项 */
export interface LocalSearchResultItem {
  id: string;
  title: string;
  content: string;
  type: string;
  sourceDesc?: string | null;
  topicTags: string[];
  sceneTags: string[];
  emotionTags: string[];
  useCount: number;
  score: number;
  source: 'material' | 'snippet';
}

/** 互联网搜索结果项 */
export interface WebSearchResultItem {
  id: string;
  title: string;
  snippet: string;
  url: string;
  siteName: string;
  authLevel: number;
  /** LLM 概括后的内容 */
  summarizedContent?: string;
  /** 可直接入库的素材格式 */
  materialFormat?: MaterialFormat;
}

/** 可入库的素材格式 */
export interface MaterialFormat {
  title: string;
  type: string;
  content: string;
  sourceDesc: string;
  sourceUrl: string;
  topicTags: string[];
  sceneTags?: string[];
}

/** 统一搜索响应 */
export interface UnifiedSearchResponse {
  success: boolean;
  source: 'local' | 'web' | 'mixed' | 'empty';
  localResults: LocalSearchResultItem[];
  webResults: WebSearchResultItem[];
  summary?: string;
  suggestedKeywords?: string[];
  /** 本地搜索是否有结果（用于前端决定是否显示互联网搜索提示） */
  localHasResults: boolean;
}

/** 互联网搜索请求（前端按需触发） */
export interface WebSearchRequest {
  /** 搜索关键词 */
  query: string;
  /** 限定领域 */
  domains?: DomainKey[];
  /** 返回数量，默认 5 */
  limit?: number;
  /** 是否需要 LLM 概括+素材化，默认 true */
  needSummary?: boolean;
  /** workspaceId（后端从 auth 获取，前端无需传） */
  workspaceId?: string;
}

/** SSE 事件类型 */
export type SSEEventType = 'progress' | 'results' | 'summarizing' | 'summary' | 'done' | 'error';

/** SSE 事件数据 */
export interface SSEEvent {
  event: SSEEventType;
  data: unknown;
}

/** SSE progress 事件 */
export interface SSEProgressData {
  message: string;
  phase: 'searching' | 'fetching' | 'processing';
}

/** SSE results 事件 */
export interface SSEResultsData {
  items: WebSearchResultItem[];
}

/** SSE summary 事件 */
export interface SSESummaryData {
  materialFormats: MaterialFormat[];
  summary?: string;
}

/** SSE done 事件 */
export interface SSEDoneData {
  source: 'web';
  totalCount: number;
  cached: boolean;
}

/** SSE error 事件 */
export interface SSEErrorData {
  message: string;
  code?: string;
}

/** 概括请求（单独调用） */
export interface SummarizeRequest {
  items: {
    title: string;
    snippet: string;
    url: string;
    siteName: string;
  }[];
  query: string;
  format?: 'material' | 'snippet';
}

/** 保存到素材库请求 */
export interface SaveToMaterialRequest {
  materialFormat: MaterialFormat;
  workspaceId: string;
}
