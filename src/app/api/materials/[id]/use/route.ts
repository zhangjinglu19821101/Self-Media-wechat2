/**
 * 素材使用记录 API
 * POST - 记录素材使用
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { materialLibrary, materialUsageLog } from '@/lib/db/schema/material-library';
import { sql } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/materials/[id]/use
 * 记录素材使用
 * 
 * Body:
 * - articleId: 文章ID
 * - articleTitle: 文章标题
 * - usedPosition: 使用位置
 * - effectType: 效果类型 (good/neutral/bad)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { articleId, articleTitle, usedPosition, effectType } = body;

    // 检查素材是否存在
    const [existing] = await db
      .select()
      .from(materialLibrary)
      .where(sql`${materialLibrary.id} = ${id}::uuid`);

    if (!existing) {
      return NextResponse.json({
        success: false,
        error: '素材不存在'
      }, { status: 404 });
    }

    // 记录使用日志
    const [usageLog] = await db
      .insert(materialUsageLog)
      .values({
        materialId: existing.id,
        articleId,
        articleTitle,
        usedPosition,
        effectType
      })
      .returning();

    // 更新素材使用统计
    const updateData: Record<string, any> = {
      useCount: (existing.useCount || 0) + 1,
      lastUsedAt: new Date(),
      updatedAt: new Date()
    };

    // 更新效果统计
    if (effectType === 'good') {
      updateData.effectiveCount = (existing.effectiveCount || 0) + 1;
    } else if (effectType === 'bad') {
      updateData.ineffectiveCount = (existing.ineffectiveCount || 0) + 1;
    }

    await db
      .update(materialLibrary)
      .set(updateData)
      .where(sql`${materialLibrary.id} = ${id}::uuid`);

    return NextResponse.json({
      success: true,
      data: usageLog,
      message: '使用记录已保存'
    });
  } catch (error: any) {
    console.error('[MaterialUseAPI] POST error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
