/**
 * 搜索 MCP 能力实现
 *
 * 实现 3 个搜索相关的 MCP 能力：
 * 1. ID 16: 联网搜索-网页搜索 (webSearch)
 * 2. ID 17: 联网搜索-网页搜索带摘要 (webSearchWithSummary)
 * 3. ID 18: 联网搜索-图片搜索 (imageSearch)
 *
 * 设计原则：
 * 1. 易读：代码结构清晰，注释完善
 * 2. 易维护：继承 BaseMCPCapabilityExecutor
 * 3. 易扩展：新增搜索能力只需添加新的实现类
 *
 * @docs /docs/详细设计文档agent智能交互MCP能力设计capability_type.md
 */

import { BaseMCPCapabilityExecutor, MCPCapabilityExecutorFactory } from './mcp-executor';
import { MCPExecutionResult } from './types';

// ============================================================================
// 类型定义
// ============================================================================

export interface SearchMCPResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    query: string;
    type: string;
    count: number;
    timestamp: number;
  };
}

export interface WebSearchParams {
  query: string;
  count?: number;
  needContent?: boolean;
  agentId?: string;
}

export interface WebSearchWithSummaryParams {
  query: string;
  count?: number;
  needContent?: boolean;
  agentId?: string;
}

export interface ImageSearchParams {
  query: string;
  count?: number;
  agentId?: string;
}

export interface WebSearchItem {
  title: string;
  url: string;
  content?: string;
  summary?: string;
  published_time?: string;
  author?: string;
}

export interface ImageSearchItem {
  url: string;
  title?: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
}

export interface WebSearchResult {
  query: string;
  type: 'web';
  count: number;
  web_items: WebSearchItem[];
  timestamp: string;
}

export interface WebSearchWithSummaryResult {
  query: string;
  type: 'web_summary';
  count: number;
  web_items: WebSearchItem[];
  summary?: string;
  timestamp: string;
}

export interface ImageSearchResult {
  query: string;
  type: 'image';
  count: number;
  image_items: ImageSearchItem[];
  timestamp: string;
}

// ============================================================================
// 工具函数（内部使用，不导出
// ============================================================================

/**
 * 网页搜索
 */
async function webSearch(params: WebSearchParams): Promise<SearchMCPResult<WebSearchResult>> {
  console.log('[MCP Tool] webSearch 开始执行，参数:', params);
  const startTime = Date.now();
  
  try {
    const { query, count = 10, needContent = false, agentId } = params;

    // 验证参数
    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: '查询词不能为空',
        metadata: { query, type: 'web', count, timestamp: Date.now() },
      };
    }

    if (count < 1 || count > 50) {
      return {
        success: false,
        error: '结果数量必须在1-50之间',
        metadata: { query, type: 'web', count, timestamp: Date.now() },
      };
    }

    // 构建搜索 URL
    const searchUrl = new URL('http://localhost:5000/api/search');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('count', count.toString());
    searchUrl.searchParams.set('type', 'web');
    if (needContent) {
      searchUrl.searchParams.set('needContent', 'true');
    }
    if (agentId) {
      searchUrl.searchParams.set('agentId', agentId);
    }

    // 调用搜索 API
    const response = await fetch(searchUrl.toString(), {
      headers: { 'x-internal-token': process.env.INTERNAL_API_TOKEN || 'internal-svc-token-2025-07' },
    });
    
    if (!response.ok) {
      throw new Error(`搜索 API 请求失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      return {
        success: false,
        error: result.error || '搜索失败',
        metadata: { query, type: 'web', count, timestamp: Date.now() },
      };
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`[MCP Tool] webSearch 执行完成，耗时 ${duration}ms，结果:`, { success: true, dataSize: JSON.stringify(result.data).length });
    
    return {
      success: true,
      data: result.data,
      metadata: { query, type: 'web', count, timestamp: Date.now() },
    };
  } catch (error: any) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.error(`[MCP Tool] webSearch 执行失败，耗时 ${duration}ms，错误:`, error.message);
    
    return {
      success: false,
      error: `网页搜索失败: ${error.message}`,
      metadata: { 
        query: params.query, 
        type: 'web', 
        count: params.count || 10, 
        timestamp: Date.now() 
      },
    };
  }
}

/**
 * 网页搜索带摘要
 */
async function webSearchWithSummary(params: WebSearchWithSummaryParams): Promise<SearchMCPResult<WebSearchWithSummaryResult>> {
  console.log('[MCP Tool] webSearchWithSummary 开始执行，参数:', params);
  const startTime = Date.now();
  
  try {
    const { query, count = 10, needContent = false, agentId } = params;

    // 验证参数
    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: '查询词不能为空',
        metadata: { query, type: 'web_summary', count, timestamp: Date.now() },
      };
    }

    if (count < 1 || count > 50) {
      return {
        success: false,
        error: '结果数量必须在1-50之间',
        metadata: { query, type: 'web_summary', count, timestamp: Date.now() },
      };
    }

    // 构建搜索 URL
    const searchUrl = new URL('http://localhost:5000/api/search');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('count', count.toString());
    searchUrl.searchParams.set('type', 'web_summary');
    if (needContent) {
      searchUrl.searchParams.set('needContent', 'true');
    }
    if (agentId) {
      searchUrl.searchParams.set('agentId', agentId);
    }

    // 调用搜索 API
    const response = await fetch(searchUrl.toString(), {
      headers: { 'x-internal-token': process.env.INTERNAL_API_TOKEN || 'internal-svc-token-2025-07' },
    });
    
    if (!response.ok) {
      throw new Error(`搜索 API 请求失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      return {
        success: false,
        error: result.error || '搜索失败',
        metadata: { query, type: 'web_summary', count, timestamp: Date.now() },
      };
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`[MCP Tool] webSearchWithSummary 执行完成，耗时 ${duration}ms，结果:`, { success: true, dataSize: JSON.stringify(result.data).length });
    
    return {
      success: true,
      data: result.data,
      metadata: { query, type: 'web_summary', count, timestamp: Date.now() },
    };
  } catch (error: any) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.error(`[MCP Tool] webSearchWithSummary 执行失败，耗时 ${duration}ms，错误:`, error.message);
    
    return {
      success: false,
      error: `网页搜索失败: ${error.message}`,
      metadata: { 
        query: params.query, 
        type: 'web_summary', 
        count: params.count || 10, 
        timestamp: Date.now() 
      },
    };
  }
}

/**
 * 图片搜索
 */
async function imageSearch(params: ImageSearchParams): Promise<SearchMCPResult<ImageSearchResult>> {
  console.log('[MCP Tool] imageSearch 开始执行，参数:', params);
  const startTime = Date.now();
  
  try {
    const { query, count = 10, agentId } = params;

    // 验证参数
    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: '查询词不能为空',
        metadata: { query, type: 'image', count, timestamp: Date.now() },
      };
    }

    if (count < 1 || count > 50) {
      return {
        success: false,
        error: '结果数量必须在1-50之间',
        metadata: { query, type: 'image', count, timestamp: Date.now() },
      };
    }

    // 构建搜索 URL
    const searchUrl = new URL('http://localhost:5000/api/search');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('count', count.toString());
    searchUrl.searchParams.set('type', 'image');
    if (agentId) {
      searchUrl.searchParams.set('agentId', agentId);
    }

    // 调用搜索 API
    const response = await fetch(searchUrl.toString(), {
      headers: { 'x-internal-token': process.env.INTERNAL_API_TOKEN || 'internal-svc-token-2025-07' },
    });
    
    if (!response.ok) {
      throw new Error(`搜索 API 请求失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      return {
        success: false,
        error: result.error || '搜索失败',
        metadata: { query, type: 'image', count, timestamp: Date.now() },
      };
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`[MCP Tool] imageSearch 执行完成，耗时 ${duration}ms，结果:`, { success: true, dataSize: JSON.stringify(result.data).length });
    
    return {
      success: true,
      data: result.data,
      metadata: { query, type: 'image', count, timestamp: Date.now() },
    };
  } catch (error: any) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.error(`[MCP Tool] imageSearch 执行失败，耗时 ${duration}ms，错误:`, error.message);
    
    return {
      success: false,
      error: `图片搜索失败: ${error.message}`,
      metadata: { 
        query: params.query, 
        type: 'image', 
        count: params.count || 10, 
        timestamp: Date.now() 
      },
    };
  }
}

// ============================================================================
// ID 16: 联网搜索-网页搜索 (webSearch)
// ============================================================================

/**
 * 联网搜索-网页搜索 MCP 执行器
 * 能力 ID: 16
 */
class WebSearchExecutor extends BaseMCPCapabilityExecutor {
  readonly capabilityId = 16;
  readonly capabilityName = '联网搜索-网页搜索';

  /**
   * 执行网页搜索
   * @param params 搜索参数 { query, count? }
   * @returns MCP 执行结果
   */
  protected async execute(params: Record<string, any>): Promise<MCPExecutionResult> {
    console.log(`[WebSearch] 执行网页搜索，参数:`, params);

    try {
      const { query, count = 10 } = params;

      // 调用搜索工具
      const result = await webSearch({
        query,
        count: Math.max(1, Math.min(50, count)), // 确保在 1-50 之间
      });

      if (!result.success) {
        console.error(`[WebSearch] 搜索失败:`, result.error);
        return {
          success: false,
          error: result.error || '搜索失败',
          executionTime: new Date().toISOString(),
        };
      }

      console.log(`[WebSearch] 搜索成功，返回 ${result.data?.count || 0} 条结果`);

      return {
        success: true,
        data: {
          query: result.data?.query,
          type: result.data?.type,
          count: result.data?.count,
          results: result.data?.web_items,
          timestamp: result.data?.timestamp,
        },
        executionTime: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[WebSearch] 执行异常:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '搜索执行失败',
        executionTime: new Date().toISOString(),
      };
    }
  }
}

// ============================================================================
// ID 17: 联网搜索-网页搜索带摘要 (webSearchWithSummary)
// ============================================================================

/**
 * 联网搜索-网页搜索带摘要 MCP 执行器
 * 能力 ID: 17
 */
class WebSearchWithSummaryExecutor extends BaseMCPCapabilityExecutor {
  readonly capabilityId = 17;
  readonly capabilityName = '联网搜索-网页搜索带摘要';

  /**
   * 执行网页搜索带摘要
   * @param params 搜索参数 { query, count? }
   * @returns MCP 执行结果
   */
  protected async execute(params: Record<string, any>): Promise<MCPExecutionResult> {
    console.log(`[WebSearchWithSummary] 执行网页搜索带摘要，参数:`, params);

    try {
      const { query, count = 10 } = params;

      // 调用搜索工具
      const result = await webSearchWithSummary({
        query,
        count: Math.max(1, Math.min(50, count)), // 确保在 1-50 之间
      });

      if (!result.success) {
        console.error(`[WebSearchWithSummary] 搜索失败:`, result.error);
        return {
          success: false,
          error: result.error || '搜索失败',
          executionTime: new Date().toISOString(),
        };
      }

      console.log(`[WebSearchWithSummary] 搜索成功，返回 ${result.data?.count || 0} 条结果`);

      return {
        success: true,
        data: {
          query: result.data?.query,
          type: result.data?.type,
          count: result.data?.count,
          summary: result.data?.summary,
          results: result.data?.web_items,
          timestamp: result.data?.timestamp,
        },
        executionTime: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[WebSearchWithSummary] 执行异常:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '搜索执行失败',
        executionTime: new Date().toISOString(),
      };
    }
  }
}

// ============================================================================
// ID 18: 联网搜索-图片搜索 (imageSearch)
// ============================================================================

/**
 * 联网搜索-图片搜索 MCP 执行器
 * 能力 ID: 18
 */
class ImageSearchExecutor extends BaseMCPCapabilityExecutor {
  readonly capabilityId = 18;
  readonly capabilityName = '联网搜索-图片搜索';

  /**
   * 执行图片搜索
   * @param params 搜索参数 { query, count? }
   * @returns MCP 执行结果
   */
  protected async execute(params: Record<string, any>): Promise<MCPExecutionResult> {
    console.log(`[ImageSearch] 执行图片搜索，参数:`, params);

    try {
      const { query, count = 10 } = params;

      // 调用搜索工具
      const result = await imageSearch({
        query,
        count: Math.max(1, Math.min(50, count)), // 确保在 1-50 之间
      });

      if (!result.success) {
        console.error(`[ImageSearch] 搜索失败:`, result.error);
        return {
          success: false,
          error: result.error || '搜索失败',
          executionTime: new Date().toISOString(),
        };
      }

      console.log(`[ImageSearch] 搜索成功，返回 ${result.data?.count || 0} 条结果`);

      return {
        success: true,
        data: {
          query: result.data?.query,
          type: result.data?.type,
          count: result.data?.count,
          results: result.data?.image_items,
          timestamp: result.data?.timestamp,
        },
        executionTime: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[ImageSearch] 执行异常:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '搜索执行失败',
        executionTime: new Date().toISOString(),
      };
    }
  }
}

// ============================================================================
// 注册到工厂
// ============================================================================

MCPCapabilityExecutorFactory.registerExecutor(new WebSearchExecutor());
MCPCapabilityExecutorFactory.registerExecutor(new WebSearchWithSummaryExecutor());
MCPCapabilityExecutorFactory.registerExecutor(new ImageSearchExecutor());

// ============================================================================
// 搜索工具对象命名空间（与 wechat-tools.ts 保持一致）
// ============================================================================

/**
 * 联网搜索 MCP 工具集
 */
export const SearchMCPTools = {
  webSearch,
  webSearchWithSummary,
  imageSearch,
};

// ============================================================================
// 导出类型供外部使用
// ============================================================================

export {
  WebSearchExecutor,
  WebSearchWithSummaryExecutor,
  ImageSearchExecutor
};

