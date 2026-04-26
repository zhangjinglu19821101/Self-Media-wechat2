/**
 * 统一搜索服务 - 主入口
 *
 * 设计原则：
 * 1. 本地优先：先查本地素材库和信息速记
 * 2. 互联网兜底：本地无结果时，用户主动触发互联网搜索
 * 3. 按需触发：互联网搜索不自动执行，由前端用户点击触发
 * 4. SSE 流式：互联网搜索结果通过 SSE 逐步推送
 * 5. 独立可复用：服务层不依赖 Next.js 运行时，未来可用于 App/小程序
 */

export type { UnifiedSearchRequest, UnifiedSearchResponse, WebSearchRequest, WebSearchResultItem, MaterialFormat, SSEEventType, SSEProgressData, SSEResultsData, SSESummaryData, SSEDoneData, SSEErrorData, DomainKey } from './types';
export { webSearcher } from './web-searcher';
export { llmProcessor } from './llm-processor';
export { getSitesForDomains, getAllDomainOptions, getDomainLabel, DEFAULT_DOMAINS, DOMAIN_GROUPS } from './domain-whitelist';
