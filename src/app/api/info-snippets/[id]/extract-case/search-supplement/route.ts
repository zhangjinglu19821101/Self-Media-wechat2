import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { infoSnippets } from '@/lib/db/schema/info-snippets';
import { eq, and } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';
import { searchAndSupplementEventStory, type CaseExtractionResult } from '@/lib/services/snippet-to-case-service';
import { HeaderUtils } from 'coze-coding-dev-sdk';

/**
 * POST /api/info-snippets/[id]/extract-case/search-supplement
 * Step 2: 异步搜索补充 eventFullStory
 * 
 * 前端在收到 Step 1 结果后异步调用此接口，不阻塞用户编辑
 * 
 * Body:
 * - extractionResult: Step 1 返回的提取结果（前端原样传回）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { id } = await params;
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    const body = await request.json();
    const extractionResult = body.extractionResult as CaseExtractionResult | undefined;

    if (!extractionResult) {
      return NextResponse.json({ error: '缺少 extractionResult 参数' }, { status: 400 });
    }

    // 查询原始速记内容
    const snippets = await db.select().from(infoSnippets).where(
      and(
        eq(infoSnippets.id, id),
        eq(infoSnippets.workspaceId, workspaceId)
      )
    );

    if (snippets.length === 0) {
      return NextResponse.json({ error: '速记不存在' }, { status: 404 });
    }

    const rawContent = snippets[0].rawContent || snippets[0].summary || snippets[0].title || '';

    // 执行搜索补充
    const supplementResult = await searchAndSupplementEventStory(
      rawContent,
      extractionResult,
      customHeaders
    );

    return NextResponse.json({
      success: true,
      data: supplementResult,
    });
  } catch (error) {
    console.error('[search-supplement] 搜索补充失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '搜索补充失败' },
      { status: 500 }
    );
  }
}
