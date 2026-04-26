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
import { getWorkspaceId } from '@/lib/auth/context';
import { webSearcher } from '@/lib/services/unified-search/web-searcher';
import { llmProcessor } from '@/lib/services/unified-search/llm-processor';
import type { WebSearchRequest, DomainKey } from '@/lib/services/unified-search/types';

/**
 * SSE 事件格式化
 */
function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const body: WebSearchRequest = await request.json();
    const { query, domains, limit = 5, needSummary = true } = body;

    if (!query?.trim()) {
      return NextResponse.json({ success: false, error: '缺少搜索关键词' }, { status: 400 });
    }

    // 检查客户端是否接受 SSE
    const accept = request.headers.get('accept') || '';
    const preferSSE = accept.includes('text/event-stream');

    // 如果客户端不支持 SSE，返回普通 JSON
    if (!preferSSE) {
      return handleJsonResponse(query, domains as DomainKey[] | undefined, limit, needSummary, workspaceId, request);
    }

    // SSE 流式响应
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Step 1: 搜索进度
          controller.enqueue(encoder.encode(sseEvent('progress', {
            message: '正在搜索权威站点...',
            phase: 'searching',
          })));

          // Step 2: 执行互联网搜索
          const webResults = await webSearcher.search(
            query,
            domains as DomainKey[] | undefined,
            limit,
            workspaceId,
            request.headers
          );

          // Step 3: 推送搜索结果
          controller.enqueue(encoder.encode(sseEvent('results', {
            items: webResults,
          })));

          // Step 4: LLM 概括 + 素材化
          if (needSummary && webResults.length > 0) {
            controller.enqueue(encoder.encode(sseEvent('progress', {
              message: 'AI 正在概括提炼...',
              phase: 'processing',
            })));

            const { materialFormats, summary } = await llmProcessor.processWebResults(webResults, query);

            // 将 materialFormat 填充到对应的 webResults 中
            webResults.forEach((item, index) => {
              if (materialFormats[index]) {
                item.materialFormat = materialFormats[index];
                item.summarizedContent = materialFormats[index].content;
              }
            });

            controller.enqueue(encoder.encode(sseEvent('summary', {
              materialFormats,
              summary,
            })));
          }

          // Step 5: 完成
          controller.enqueue(encoder.encode(sseEvent('done', {
            source: 'web',
            totalCount: webResults.length,
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
  } catch (error) {
    console.error('[UnifiedSearch/Web] API 错误:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '搜索失败' },
      { status: 500 }
    );
  }
}

/**
 * 非 SSE 模式：返回普通 JSON
 */
async function handleJsonResponse(
  query: string,
  domains: DomainKey[] | undefined,
  limit: number,
  needSummary: boolean,
  workspaceId: string,
  request: NextRequest
) {
  // 执行搜索
  const webResults = await webSearcher.search(query, domains, limit, workspaceId, request.headers);

  // LLM 概括
  let materialFormats = [];
  let summary = '';
  if (needSummary && webResults.length > 0) {
    const result = await llmProcessor.processWebResults(webResults, query);
    materialFormats = result.materialFormats;
    summary = result.summary;

    // 填充 materialFormat
    webResults.forEach((item, index) => {
      if (materialFormats[index]) {
        item.materialFormat = materialFormats[index];
        item.summarizedContent = materialFormats[index].content;
      }
    });
  }

  return NextResponse.json({
    success: true,
    source: webResults.length > 0 ? 'web' : 'empty',
    webResults,
    materialFormats,
    summary,
  });
}

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
