/**
 * POST /api/unified-search/web
 *
 * 互联网搜索 API（按需触发，SSE 流式返回）
 *
 * 流程：
 * 1. 用户点击"互联网搜索"按钮后调用
 * 2. SSE 推送搜索进度 → 搜索结果 → LLM 概括 → 完成
 * 3. 前端通过 ReadableStream 逐步渲染
 *
 * 也支持普通 JSON 响应（Accept: application/json）
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getWorkspaceId } from '@/lib/auth/context';
import { webSearcher } from '@/lib/services/unified-search/web-searcher';
import { llmProcessor } from '@/lib/services/unified-search/llm-processor';
import { searchStateStore } from '@/lib/services/unified-search/search-state-store';
import type { DomainKey } from '@/lib/services/unified-search/types';

// ==================== 请求体校验 (P0-3) ====================

const VALID_DOMAIN_KEYS: DomainKey[] = [
  'regulatory', 'media', 'finance', 'insurance', 'law', 'knowledge', 'data',
];

const webSearchRequestSchema = z.object({
  query: z.string().min(1, '搜索关键词不能为空').max(500, '搜索关键词过长'),
  domains: z.array(z.enum(VALID_DOMAIN_KEYS as [string, ...string[]])).optional(),
  limit: z.number().int().min(1).max(20).default(5),
  needSummary: z.boolean().default(true),
  /** 轮询模式（小程序不支持 SSE 时使用）：返回 searchId，通过 GET /status 轮询 */
  polling: z.boolean().default(false),
});

// ==================== SSE 工具 ====================

/**
 * SSE 事件格式化
 */
function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * 构建 SSE 错误响应（P1-1: 外层错误也用 SSE 格式返回）
 *
 * 当认证失败、请求体解析失败等发生在 SSE 流建立之前时，
 * 客户端期望 SSE 格式，而非 JSON。
 */
function sseErrorResponse(message: string, code: string, status: number = 500): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sseEvent('error', { message, code })));
      controller.close();
    },
  });

  return new Response(stream, {
    status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// ==================== 共享搜索逻辑 (P1-5) ====================

interface SearchResult {
  webResults: import('@/lib/services/unified-search/types').WebSearchResultItem[];
  materialFormats: import('@/lib/services/unified-search/types').MaterialFormat[];
  summary: string;
}

/**
 * 执行搜索 + LLM 处理的核心逻辑（SSE/JSON 共享）
 *
 * @returns 包含 webResults/materialFormats/summary 的搜索结果
 */
async function executeSearch(
  query: string,
  domains: DomainKey[] | undefined,
  limit: number,
  needSummary: boolean,
  workspaceId: string,
  requestHeaders: Headers
): Promise<SearchResult> {
  // Step 1: 执行互联网搜索
  const webResults = await webSearcher.search(query, domains, limit, workspaceId, requestHeaders);

  // Step 2: LLM 概括 + 素材化
  let materialFormats: import('@/lib/services/unified-search/types').MaterialFormat[] = [];
  let summary = '';

  if (needSummary && webResults.length > 0) {
    const result = await llmProcessor.processWebResults(webResults, query, workspaceId);
    materialFormats = result.materialFormats;
    summary = result.summary;

    // 将 materialFormat 填充到对应的 webResults 中
    // P0-1 已修复: webSearcher.search() 返回深拷贝，可安全修改
    webResults.forEach((item, index) => {
      if (materialFormats[index]) {
        item.materialFormat = materialFormats[index];
        item.summarizedContent = materialFormats[index].content;
      }
    });
  }

  return { webResults, materialFormats, summary };
}

// ==================== POST 处理器 ====================

export async function POST(request: NextRequest) {
  // 检查客户端是否期望 SSE
  const accept = request.headers.get('accept') || '';
  const preferSSE = accept.includes('text/event-stream');

  try {
    const workspaceId = await getWorkspaceId(request);

    // P0-3: 使用 Zod 校验请求体
    let parsed: z.infer<typeof webSearchRequestSchema>;
    try {
      const rawBody = await request.json();
      parsed = webSearchRequestSchema.parse(rawBody);
    } catch (validationError) {
      const message = validationError instanceof z.ZodError
        ? validationError.issues.map(e => e.message).join('; ')
        : '请求体格式错误';
      console.warn('[UnifiedSearch/Web] 请求校验失败:', message);

      // P1-1: SSE 客户端收到 SSE 格式错误，JSON 客户端收到 JSON 格式错误
      if (preferSSE) {
        return sseErrorResponse(message, 'VALIDATION_ERROR', 400);
      }
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const { query, domains, limit, needSummary, polling } = parsed;

    // 🔴 轮询模式（小程序）：返回 searchId，后台执行搜索
    if (polling) {
      const searchId = searchStateStore.createSearchState();

      // 异步执行搜索，结果写入 searchStateStore
      (async () => {
        try {
          searchStateStore.pushEvent(searchId, 'progress', {
            message: '正在搜索权威站点...',
            phase: 'searching',
          });

          const searchResult = await executeSearch(
            query, domains as DomainKey[] | undefined, limit, needSummary, workspaceId, request.headers
          );

          searchStateStore.pushEvent(searchId, 'results', {
            items: searchResult.webResults,
          });

          if (searchResult.materialFormats.length > 0) {
            searchStateStore.pushEvent(searchId, 'progress', {
              message: 'AI 正在概括提炼...',
              phase: 'processing',
            });

            searchStateStore.pushEvent(searchId, 'summary', {
              materialFormats: searchResult.materialFormats,
              summary: searchResult.summary,
            });
          }

          searchStateStore.pushEvent(searchId, 'done', {
            source: 'web',
            totalCount: searchResult.webResults.length,
            cached: false,
          });
        } catch (error) {
          console.error('[UnifiedSearch/Web] 轮询模式搜索失败:', error);
          searchStateStore.pushEvent(searchId, 'error', {
            message: error instanceof Error ? error.message : '搜索失败',
            code: 'SEARCH_ERROR',
          });
        }
      })();

      return NextResponse.json({
        success: true,
        data: {
          searchId,
          statusUrl: `/api/unified-search/web/${searchId}/status`,
          pollIntervalMs: 2000,
        },
      });
    }

    // SSE 流式响应
    if (preferSSE) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Step 1: 搜索进度
            controller.enqueue(encoder.encode(sseEvent('progress', {
              message: '正在搜索权威站点...',
              phase: 'searching',
            })));

            // Step 2: 执行搜索
            controller.enqueue(encoder.encode(sseEvent('progress', {
              message: '搜索中...',
              phase: 'searching',
            })));

            const searchResult = await executeSearch(
              query, domains as DomainKey[] | undefined, limit, needSummary, workspaceId, request.headers
            );

            // Step 3: 推送搜索结果
            controller.enqueue(encoder.encode(sseEvent('results', {
              items: searchResult.webResults,
            })));

            // Step 4: 推送 LLM 概括结果
            if (searchResult.materialFormats.length > 0) {
              controller.enqueue(encoder.encode(sseEvent('progress', {
                message: 'AI 正在概括提炼...',
                phase: 'processing',
              })));

              controller.enqueue(encoder.encode(sseEvent('summary', {
                materialFormats: searchResult.materialFormats,
                summary: searchResult.summary,
              })));
            }

            // Step 5: 完成
            controller.enqueue(encoder.encode(sseEvent('done', {
              source: 'web',
              totalCount: searchResult.webResults.length,
              cached: false,
            })));

            controller.close();
          } catch (error) {
            console.error('[UnifiedSearch/Web] SSE 流错误:', error);
            controller.enqueue(encoder.encode(sseEvent('error', {
              message: error instanceof Error ? error.message : '搜索失败',
              code: 'SEARCH_ERROR',
            })));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // 非 SSE 模式：返回普通 JSON
    const searchResult = await executeSearch(
      query, domains as DomainKey[] | undefined, limit, needSummary, workspaceId, request.headers
    );

    return NextResponse.json({
      success: true,
      source: searchResult.webResults.length > 0 ? 'web' : 'empty',
      webResults: searchResult.webResults,
      materialFormats: searchResult.materialFormats,
      summary: searchResult.summary,
    });

  } catch (error) {
    console.error('[UnifiedSearch/Web] API 错误:', error);
    // P1-1: 外层错误（认证失败等）也用 SSE 格式返回
    if (preferSSE) {
      return sseErrorResponse(
        error instanceof Error ? error.message : '搜索失败',
        'INTERNAL_ERROR',
        500,
      );
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '搜索失败' },
      { status: 500 },
    );
  }
}

// ==================== GET 处理器 ====================

/**
 * GET /api/unified-search/web
 * 获取领域选项列表（前端下拉用）
 */
export async function GET() {
  const { getAllDomainOptions, DEFAULT_DOMAINS } = await import('@/lib/services/unified-search/domain-whitelist');
  return NextResponse.json({
    success: true,
    domains: getAllDomainOptions(),
    defaultDomains: DEFAULT_DOMAINS,
  });
}
