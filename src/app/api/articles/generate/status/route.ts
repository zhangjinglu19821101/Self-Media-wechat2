import { NextRequest, NextResponse } from 'next/server';
import { getCronScheduler } from '@/lib/article-generator/instance';
import { ArticleGenerator } from '@/lib/article-generator/generator';
import { ArticleType } from '@/lib/article-generator/types';

/**
 * GET /api/articles/generate/status
 * 获取文章生成调度器状态
 */
export async function GET() {
  try {
    const scheduler = getCronScheduler();
    const config = scheduler.getConfig();
    const nextExecution = scheduler.getNextExecutionTimes();

    return NextResponse.json({
      success: true,
      data: {
        config,
        nextExecution: {
          ai: nextExecution.ai.toISOString(),
          insurance: nextExecution.insurance.toISOString(),
        },
        status: 'running',
      },
    });
  } catch (error: any) {
    console.error('Failed to get article generation status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
