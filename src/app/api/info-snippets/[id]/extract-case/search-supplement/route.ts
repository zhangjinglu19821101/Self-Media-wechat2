import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { infoSnippets } from '@/lib/db/schema/info-snippets';
import { eq, and } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';
import { searchAndSupplementEventStory, type CaseExtractionResult } from '@/lib/services/snippet-to-case-service';
import { HeaderUtils } from 'coze-coding-dev-sdk';

/**
 * 校验并清洗前端传回的 extractionResult
 * 防止篡改：仅保留搜索补充所需的字段，强制类型和长度约束
 */
function sanitizeExtractionResult(raw: unknown): CaseExtractionResult | null {
  if (!raw || typeof raw !== 'object') return null;

  const obj = raw as Record<string, unknown>;

  // 必须存在的字符串字段
  const title = typeof obj.title === 'string' ? obj.title.slice(0, 200) : '';
  const eventFullStory = typeof obj.eventFullStory === 'string' ? obj.eventFullStory.slice(0, 2000) : '';
  const background = typeof obj.background === 'string' ? obj.background.slice(0, 1000) : '';
  const insuranceAction = typeof obj.insuranceAction === 'string' ? obj.insuranceAction.slice(0, 500) : '';
  const result = typeof obj.result === 'string' ? obj.result.slice(0, 500) : '';

  // 后台字段
  const llmExtractedTitle = typeof obj.llmExtractedTitle === 'string' ? obj.llmExtractedTitle.slice(0, 200) : '';
  const searchKeywords = typeof obj.searchKeywords === 'string' ? obj.searchKeywords.slice(0, 200) : '';
  const protagonist = typeof obj.protagonist === 'string' ? obj.protagonist.slice(0, 100) : '';

  // 数组字段：逐元素校验
  const productTags = Array.isArray(obj.productTags)
    ? obj.productTags.filter((t: unknown) => typeof t === 'string' && (t as string).length <= 10).slice(0, 10) as string[]
    : [];
  const crowdTags = Array.isArray(obj.crowdTags)
    ? obj.crowdTags.filter((t: unknown) => typeof t === 'string' && (t as string).length <= 10).slice(0, 10) as string[]
    : [];
  const emotionTags = Array.isArray(obj.emotionTags)
    ? obj.emotionTags.filter((t: unknown) => typeof t === 'string' && (t as string).length <= 10).slice(0, 10) as string[]
    : [];

  // 枚举字段
  const VALID_CASE_TYPES = ['positive', 'warning', 'milestone'] as const;
  const VALID_INDUSTRIES = ['insurance', 'banking', 'securities', 'fund', 'trust', 'fintech'] as const;
  const caseType = VALID_CASE_TYPES.includes(obj.caseType as typeof VALID_CASE_TYPES[number])
    ? obj.caseType as typeof VALID_CASE_TYPES[number]
    : 'positive';
  const industry = VALID_INDUSTRIES.includes(obj.industry as typeof VALID_INDUSTRIES[number])
    ? obj.industry as typeof VALID_INDUSTRIES[number]
    : 'insurance';

  return {
    title,
    eventFullStory,
    background,
    insuranceAction,
    result,
    productTags,
    llmExtractedTitle,
    searchKeywords,
    protagonist,
    crowdTags,
    emotionTags,
    caseType,
    industry,
    searchPerformed: false,
    searchPending: false,
    searchSummary: null,
  };
}

/**
 * POST /api/info-snippets/[id]/extract-case/search-supplement
 * Step 2: 异步搜索补充 eventFullStory
 * 
 * 前端在收到 Step 1 结果后异步调用此接口，不阻塞用户编辑
 * 
 * Body:
 * - extractionResult: Step 1 返回的提取结果（前端原样传回，后端校验后使用）
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
    const sanitized = sanitizeExtractionResult(body.extractionResult);

    if (!sanitized) {
      return NextResponse.json({ error: 'extractionResult 参数格式无效' }, { status: 400 });
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

    // 执行搜索补充（使用校验后的 extractionResult）
    const supplementResult = await searchAndSupplementEventStory(
      rawContent,
      sanitized,
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
