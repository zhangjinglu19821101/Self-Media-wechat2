/**
 * GET /api/unified-search/web/[searchId]/status
 * 
 * 小程序搜索状态轮询端点
 * 
 * 流程：
 * 1. 前端 POST /api/unified-search/web（body 带 polling: true）→ 返回 { searchId }
 * 2. 前端每 2 秒 GET 此端点 → 获取搜索进度和结果
 * 3. 当 status=done 或 status=error 时停止轮询
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchStateStore } from '@/lib/services/unified-search/search-state-store';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ searchId: string }> },
) {
  const { searchId } = await params;

  const state = searchStateStore.getSearchState(searchId);
  if (!state) {
    return NextResponse.json(
      { success: false, error: '搜索任务不存在或已过期', code: 'SEARCH_NOT_FOUND' },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      searchId: state.searchId,
      status: state.status,
      phase: state.phase,
      webResults: state.webResults,
      materialFormats: state.materialFormats,
      summary: state.summary,
      error: state.error,
      totalCount: state.totalCount,
      source: state.source,
      cached: state.cached,
    },
  });
}
