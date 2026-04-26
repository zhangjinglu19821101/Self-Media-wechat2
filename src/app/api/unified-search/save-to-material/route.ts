/**
 * POST /api/unified-search/save-to-material
 *
 * 将互联网搜索的 LLM 概括结果保存到素材库
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceId } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { eq, and } from 'drizzle-orm';
import type { MaterialFormat } from '@/lib/services/unified-search/types';

export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();
    const { materialFormat }: { materialFormat: MaterialFormat } = body;

    if (!materialFormat?.title || !materialFormat?.content) {
      return NextResponse.json({ success: false, error: '缺少素材标题或内容' }, { status: 400 });
    }

    // 查重：同标题+同来源URL（防止重复入库）
    const sourceUrl = materialFormat.sourceUrl || '';
    const existing = await db
      .select({ id: materialLibrary.id })
      .from(materialLibrary)
      .where(
        and(
          eq(materialLibrary.workspaceId, workspaceId),
          eq(materialLibrary.title, materialFormat.title),
          eq(materialLibrary.sourceUrl, sourceUrl)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({
        success: true,
        message: '该素材已存在',
        materialId: existing[0].id,
        duplicate: true,
      });
    }

    // 写入素材库
    const [inserted] = await db.insert(materialLibrary).values({
      title: materialFormat.title,
      type: materialFormat.type || 'data',
      content: materialFormat.content,
      sourceType: 'import',
      sourceDesc: materialFormat.sourceDesc || '互联网搜索',
      sourceUrl,
      topicTags: materialFormat.topicTags || [],
      sceneTags: materialFormat.sceneTags || [],
      workspaceId,
      status: 'active',
    }).returning({ id: materialLibrary.id });

    return NextResponse.json({
      success: true,
      message: '素材已保存',
      materialId: inserted?.id,
    });
  } catch (error) {
    console.error('[UnifiedSearch/SaveToMaterial] 保存失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '保存失败' },
      { status: 500 }
    );
  }
}
