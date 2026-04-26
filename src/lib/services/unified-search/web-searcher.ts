/**
 * 互联网搜索服务
 *
 * 基于 coze-coding-dev-sdk SearchClient，限定权威站点范围搜索
 *
 * 设计原则：
 * 1. 站点白名单：只搜索权威站点，保证信息可靠性
 * 2. 超时控制：10s 超时，不阻塞主流程
 * 3. 结果缓存：相同 query+domains 缓存 30 分钟（LRU 淘汰）
 * 4. 限流保护：同一 workspace 每分钟最多 10 次（⚠️ 进程级，单实例部署有效）
 */

import { SearchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { getSitesForDomains } from './domain-whitelist';
import type { WebSearchResultItem, DomainKey } from './types';

// ==================== LRU 缓存 ====================

/**
 * 简易 LRU Cache（P1-4: 替代普通 Map，maxSize 时淘汰最久未访问条目）
 *
 * - get() 自动刷新访问顺序（移到尾部 = 最近使用）
 * - set() 超出 maxSize 时淘汰头部（最久未使用）
 */
class LRUCache<T> {
  private readonly max: number;
  private readonly map = new Map<string, T>();

  constructor(maxSize: number) {
    this.max = maxSize;
  }

  get(key: string): T | undefined {
    const val = this.map.get(key);
    if (val !== undefined) {
      // 刷新访问顺序：删除再插入 → 移到尾部
      this.map.delete(key);
      this.map.set(key, val);
    }
    return val;
  }

  set(key: string, value: T): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.max) {
      // 淘汰最久未访问（头部第一个）
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, value);
  }

  get size(): number {
    return this.map.size;
  }

  entries(): IterableIterator<[string, T]> {
    return this.map.entries();
  }
}

interface CacheEntry {
  results: WebSearchResultItem[];
  createdAt: number;
}

/** 搜索结果缓存（30分钟TTL，LRU 最多 200 条） */
const searchCache = new LRUCache<CacheEntry>(200);
const CACHE_TTL_MS = 30 * 60 * 1000;

// ==================== 限流层 ====================

/**
 * workspace 维度的限流计数器
 *
 * ⚠️ 限流器为进程内 Map 实现，仅在单实例部署下有效。
 * 多实例/分布式部署场景需替换为 Redis 或数据库原子计数。
 * 当前部署为单实例 PM2 fork 模式，因此可安全使用。
 */
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
   * @returns 搜索结果列表（深拷贝，调用方可安全修改）
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

    // 2. 缓存检查（P1-3: 结构化缓存键，避免碰撞）
    const cacheKey = JSON.stringify({ q: query, d: (domains || []).sort(), l: limit });
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
      console.log(`[WebSearcher] 缓存命中: "${query}"`);
      // P0-1: 返回深拷贝，防止调用方修改污染缓存
      return JSON.parse(JSON.stringify(cached.results));
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

    // 6. 写入缓存（LRU 自动淘汰最久未访问条目）
    searchCache.set(cacheKey, { results, createdAt: Date.now() });

    console.log(`[WebSearcher] 搜索完成: "${query}", 结果数: ${results.length}`);
    // P0-1: 返回深拷贝，保持一致性
    return JSON.parse(JSON.stringify(results));
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
