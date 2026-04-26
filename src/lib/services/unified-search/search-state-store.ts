/**
 * 搜索状态存储服务
 * 
 * 为不支持 SSE 的小程序提供分块 JSON 轮询模式：
 * 1. 前端 POST /api/unified-search/web → 返回 { searchId }
 * 2. 前端 GET  /api/unified-search/web/[searchId]/status → 返回当前进度和结果
 * 3. 每 2 秒轮询，直到 status=done
 * 
 * 使用内存 Map 存储（单实例足够，进程重启搜索会丢失）
 */

import type { WebSearchResultItem, MaterialFormat, SSEEventType } from '@/lib/services/unified-search/types';

// ==================== 类型 ====================

export interface SearchState {
  searchId: string;
  status: 'searching' | 'processing' | 'done' | 'error';
  /** 当前阶段描述 */
  phase: string;
  /** 搜索结果（搜索完成后填充） */
  webResults: WebSearchResultItem[];
  /** LLM 概括结果（概括完成后填充） */
  materialFormats: MaterialFormat[];
  /** 摘要文本 */
  summary: string;
  /** 错误信息 */
  error: string | null;
  /** 创建时间 */
  createdAt: number;
  /** 最后更新时间 */
  updatedAt: number;
  /** 来源 */
  source: string;
  /** 结果总数 */
  totalCount: number;
  /** 是否缓存 */
  cached: boolean;
}

// ==================== 存储 ====================

const SEARCH_STATES = new Map<string, SearchState>();

/** 最大存储条数（防止内存泄漏） */
const MAX_STATES = 500;

/** 过期时间（10 分钟） */
const STATE_TTL_MS = 10 * 60 * 1000;

// ==================== 服务 ====================

export class SearchStateStore {
  /**
   * 创建搜索状态
   */
  createSearchState(): string {
    const searchId = `search-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const state: SearchState = {
      searchId,
      status: 'searching',
      phase: '初始化搜索...',
      webResults: [],
      materialFormats: [],
      summary: '',
      error: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: 'web',
      totalCount: 0,
      cached: false,
    };

    SEARCH_STATES.set(searchId, state);
    this.cleanup();
    return searchId;
  }

  /**
   * 获取搜索状态
   */
  getSearchState(searchId: string): SearchState | null {
    return SEARCH_STATES.get(searchId) || null;
  }

  /**
   * 更新搜索状态
   */
  updateSearchState(searchId: string, update: Partial<SearchState>): void {
    const state = SEARCH_STATES.get(searchId);
    if (!state) return;

    Object.assign(state, update, { updatedAt: Date.now() });
  }

  /**
   * 推送 SSE 事件到搜索状态（模拟 SSE 事件序列）
   */
  pushEvent(searchId: string, event: SSEEventType, data: unknown): void {
    const state = SEARCH_STATES.get(searchId);
    if (!state) return;

    switch (event) {
      case 'progress':
        if (data && typeof data === 'object' && 'phase' in data) {
          state.phase = (data as { message?: string; phase?: string }).message || state.phase;
          if ((data as { phase?: string }).phase === 'processing') {
            state.status = 'processing';
          }
        }
        break;
      case 'results':
        if (data && typeof data === 'object' && 'items' in data) {
          state.webResults = (data as { items: WebSearchResultItem[] }).items;
          state.totalCount = state.webResults.length;
          state.status = 'processing';
          state.phase = '搜索完成，正在处理...';
        }
        break;
      case 'summary':
        if (data && typeof data === 'object') {
          const summaryData = data as { materialFormats?: MaterialFormat[]; summary?: string };
          state.materialFormats = summaryData.materialFormats || [];
          state.summary = summaryData.summary || '';
        }
        break;
      case 'done':
        if (data && typeof data === 'object') {
          const doneData = data as { source?: string; totalCount?: number; cached?: boolean };
          state.source = doneData.source || 'web';
          state.totalCount = doneData.totalCount || state.totalCount;
          state.cached = doneData.cached || false;
        }
        state.status = 'done';
        state.phase = '搜索完成';
        break;
      case 'error':
        state.status = 'error';
        state.error = (data as { message?: string })?.message || '搜索失败';
        break;
    }

    state.updatedAt = Date.now();
  }

  /**
   * 清理过期和超量状态
   */
  private cleanup(): void {
    const now = Date.now();

    // 清理过期
    for (const [key, state] of SEARCH_STATES) {
      if (now - state.createdAt > STATE_TTL_MS) {
        SEARCH_STATES.delete(key);
      }
    }

    // 清理超量（按创建时间排序，删除最旧的）
    if (SEARCH_STATES.size > MAX_STATES) {
      const entries = [...SEARCH_STATES.entries()]
        .sort((a, b) => a[1].createdAt - b[1].createdAt);
      const toDelete = entries.slice(0, entries.length - MAX_STATES);
      for (const [key] of toDelete) {
        SEARCH_STATES.delete(key);
      }
    }
  }
}

/** 单例 */
export const searchStateStore = new SearchStateStore();
