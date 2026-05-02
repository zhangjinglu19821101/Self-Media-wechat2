import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { infoSnippets } from '@/lib/db/schema/info-snippets';
import { eq, and } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';
import { extractCaseFromSnippet } from '@/lib/services/snippet-to-case-service';
import { HeaderUtils } from 'coze-coding-dev-sdk';

/**
 * POST /api/info-snippets/[id]/extract-case
 * Step 1: LLM 提取案例结构化信息（仅一次 LLM 调用，尽快返回）
 * 
 * 搜索补充由 Step 2 (/extract-case/search-supplement) 异步完成
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { id } = await params;
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    // 查询原始速记（带 workspaceId 隔离）
    const snippets = await db.select().from(infoSnippets).where(
      and(
        eq(infoSnippets.id, id),
        eq(infoSnippets.workspaceId, workspaceId)
      )
    );

    if (snippets.length === 0) {
      return NextResponse.json({ error: '速记不存在' }, { status: 404 });
    }

    const snippet = snippets[0];
    const rawContent = snippet.rawContent || snippet.summary || snippet.title || '';

    if (!rawContent.trim()) {
      return NextResponse.json({ error: '速记内容为空，无法提取案例' }, { status: 400 });
    }

    // Step 1: 仅 LLM 提取，不含搜索（搜索由前端异步调用 Step 2）
    const extractionResult = await extractCaseFromSnippet(rawContent, snippet.title, customHeaders);

    return NextResponse.json({
      success: true,
      data: {
        snippetId: id,
        snippetTitle: snippet.title,
        ...extractionResult,
      },
    });
  } catch (error) {
    console.error('[extract-case] 提取失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '案例提取失败' },
      { status: 500 }
    );
  }
}
