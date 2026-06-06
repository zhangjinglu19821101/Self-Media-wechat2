/**
 * 素材来源文章列表 API
 * GET - 获取有素材关联的来源文章列表（去重），用于筛选下拉
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { articleContent } from '@/lib/db/schema';
import { eq, sql, and, isNotNull, inArray } from 'drizzle-orm';
import { getWorkspaceId, isSuperAdmin, getAuthContext } from '@/lib/auth/context';

export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const authContext = await getAuthContext(request);
    const isAdmin = authContext?.role === 'owner' || authContext?.role === 'admin' || isSuperAdmin(request);

    // 查询有素材关联的 sourceArticleId（去重）
    const visibilityCondition = isAdmin
      ? sql`true`
      : sql`(${materialLibrary.ownerType} = 'system' OR ${materialLibrary.workspaceId} = ${workspaceId})`;

    const sourceArticleIdsResult = await db
      .selectDistinct({ sourceArticleId: materialLibrary.sourceArticleId })
      .from(materialLibrary)
      .where(
        and(
          isNotNull(materialLibrary.sourceArticleId),
          sql`${visibilityCondition}`
        )
      );

    const sourceArticleIds = sourceArticleIdsResult
      .map(r => r.sourceArticleId)
      .filter((id): id is string => !!id);

    if (sourceArticleIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: []
      });
    }

    // 查询文章标题
    const articles = await db
      .select({
        articleId: articleContent.articleId,
        articleTitle: articleContent.articleTitle,
      })
      .from(articleContent)
      .where(inArray(articleContent.articleId, sourceArticleIds));

    // 查询每个来源文章的素材数量
    const countResult = await db
      .select({
        sourceArticleId: materialLibrary.sourceArticleId,
        count: sql<number>`count(*)`,
      })
      .from(materialLibrary)
      .where(
        and(
          isNotNull(materialLibrary.sourceArticleId),
          sql`${visibilityCondition}`
        )
      )
      .groupBy(materialLibrary.sourceArticleId);

    const countMap = Object.fromEntries(
      countResult.map(r => [r.sourceArticleId!, Number(r.count)])
    );

    const articleMap = Object.fromEntries(
      articles.map(a => [a.articleId, a.articleTitle || '未知文章'])
    );

    const result = sourceArticleIds.map(id => ({
      sourceArticleId: id,
      sourceArticleTitle: articleMap[id] || '未知文章',
      materialCount: countMap[id] || 0,
    })).sort((a, b) => b.materialCount - a.materialCount);

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error: unknown) {
    console.error('[SourceArticlesAPI] GET error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
