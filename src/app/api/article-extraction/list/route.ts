/**
 * 文章提取记录列表 API
 * GET /api/article-extraction/list
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceId } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { articleExtractions } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const offset = (page - 1) * pageSize;

    const [extractions, countResult] = await Promise.all([
      db.select({
        id: articleExtractions.id,
        articleTitle: articleExtractions.articleTitle,
        assetValueScore: articleExtractions.assetValueScore,
        reusableDimensionCount: articleExtractions.reusableDimensionCount,
        extractionSummary: articleExtractions.extractionSummary,
        templateId: articleExtractions.templateId,
        createdAt: articleExtractions.createdAt,
      })
        .from(articleExtractions)
        .where(eq(articleExtractions.workspaceId, workspaceId as string))
        .orderBy(desc(articleExtractions.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(articleExtractions)
        .where(eq(articleExtractions.workspaceId, workspaceId as string)),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        items: extractions,
        total: countResult[0]?.count || 0,
        page,
        pageSize,
      },
    });
  } catch (error) {
    console.error('[ArticleExtraction] 查询列表失败:', error);
    return NextResponse.json(
      { success: false, error: '查询失败' },
      { status: 500 }
    );
  }
}
