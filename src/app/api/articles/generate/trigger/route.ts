import { NextRequest, NextResponse } from 'next/server';
import { getCronScheduler } from '@/lib/article-generator/instance';
import { requireAuth } from '@/lib/auth/context';

/**
 * POST /api/articles/generate/trigger
 * 手动触发文章生成
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { type = 'ai', count = 1 } = body;

    const scheduler = getCronScheduler();

    if (type === 'ai') {
      await scheduler.triggerAIArticleGeneration(count);
    } else if (type === 'insurance') {
      await scheduler.triggerInsuranceArticleGeneration(count);
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid article type. Must be "ai" or "insurance"',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Article generation triggered successfully. Type: ${type}, Count: ${count}`,
    });
  } catch (error: any) {
    console.error('Failed to trigger article generation:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
