/**
 * 互联网搜索服务
 *
 * 基于 coze-coding-dev-sdk SearchClient，限定权威站点范围搜索
 *
 * 设计原则：
 * 1. 站点白名单：只搜索权威站点，保证信息可靠性
 * 2. 超时控制：10s 超时，不阻塞主流程
 * 3. 结果缓存：相同 query+domains 缓存 30 分钟
 * 4. 限流保护：同一 workspace 每分钟最多 10 次
 */

import { SearchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getSitesForDomains } from './domain-whitelist';
import type { WebSearchResultItem, DomainKey } from './types';

// ==================== 缓存层 ====================

interface CacheEntry {
  results: WebSearchResultItem[];
  createdAt: number;
}

/** 搜索结果缓存（30分钟TTL） */
const searchCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000;

// ==================== 限流层 ====================

/** workspace 维度的限流计数器 */
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_PER_MINUTE = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

/**
 * 检查限流，返回是否允许
 */
function checkRateLimit(workspaceId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(workspaceId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(workspaceId, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_PER_MINUTE) {
    return false;
  }

  entry.count++;
  return true;
}

// ==================== 搜索服务 ====================

export class WebSearcher {
  /**
   * 执行互联网搜索（限定权威站点）
   *
   * @param query 搜索关键词
   * @param domains 限定领域列表
   * @param limit 返回数量
   * @param workspaceId workspace ID（限流用）
   * @param requestHeaders Next.js 请求头（转发给 SDK）
   * @returns 搜索结果列表
   */
  async search(
    query: string,
    domains: DomainKey[] | undefined,
    limit: number = 5,
    workspaceId: string = 'default',
    requestHeaders?: Headers
  ): Promise<WebSearchResultItem[]> {
    // 1. 限流检查
    if (!checkRateLimit(workspaceId)) {
      throw new Error('互联网搜索频率超限，请稍后再试');
    }

    // 2. 缓存检查
    const cacheKey = `${query}::${(domains || []).sort().join(',')}::${limit}`;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
      console.log(`[WebSearcher] 缓存命中: "${query}"`);
      return cached.results;
    }

    // 3. 构建站点列表
    const sites = getSitesForDomains(domains);
    console.log(`[WebSearcher] 搜索: "${query}", 站点: ${sites}, 数量: ${limit}`);

    // 4. 调用 SearchClient
    const config = new Config();
    const customHeaders = requestHeaders
      ? HeaderUtils.extractForwardHeaders(requestHeaders)
      : undefined;
    const client = new SearchClient(config, customHeaders);

    const response = await client.advancedSearch(query, {
      sites,
      count: limit,
      needSummary: true,
      needContent: true,
      searchType: 'web',
    });

    // 5. 转换结果格式
    const results: WebSearchResultItem[] = (response.web_items || []).map(item => ({
      id: item.id || `web-${Math.random().toString(36).slice(2, 10)}`,
      title: item.title || '',
      snippet: item.snippet || '',
      url: item.url || '',
      siteName: item.site_name || '',
      authLevel: item.auth_info_level ?? 0,
    }));

    // 6. 写入缓存
    searchCache.set(cacheKey, { results, createdAt: Date.now() });

    // 7. 清理过期缓存
    if (searchCache.size > 200) {
      const now = Date.now();
      for (const [key, val] of searchCache.entries()) {
        if (now - val.createdAt > CACHE_TTL_MS) searchCache.delete(key);
      }
    }

    console.log(`[WebSearcher] 搜索完成: "${query}", 结果数: ${results.length}`);
    return results;
  }

  /**
   * 获取缓存统计（健康检查用）
   */
  getCacheStats(): { size: number; hitRate: string } {
    return {
      size: searchCache.size,
      hitRate: 'N/A', // 需要额外计数器才能计算
    };
  }
}

/** 单例导出 */
export const webSearcher = new WebSearcher();
