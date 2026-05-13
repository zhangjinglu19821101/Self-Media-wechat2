/**
 * 单个提取记录详情 API
 * GET /api/article-extraction/[id]
 * DELETE /api/article-extraction/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceId } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { articleExtractions, extractionLayers, extractionAssets } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspaceId = await getWorkspaceId(request);

    const [extraction] = await db.select()
      .from(articleExtractions)
      .where(and(
        eq(articleExtractions.id, id),
        eq(articleExtractions.workspaceId, workspaceId as string)
      ))
      .limit(1);

    if (!extraction) {
      return NextResponse.json(
        { success: false, error: '提取记录不存在' },
        { status: 404 }
      );
    }

    // 获取5层提取数据
    const layers = await db.select()
      .from(extractionLayers)
      .where(eq(extractionLayers.extractionId, id));

    // 获取21维数字资产
    const assets = await db.select()
      .from(extractionAssets)
      .where(eq(extractionAssets.extractionId, id));

    return NextResponse.json({
      success: true,
      data: { ...extraction, layers, assets },
    });
  } catch (error) {
    console.error('[ArticleExtraction] 查询详情失败:', error);
    return NextResponse.json(
      { success: false, error: '查询失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspaceId = await getWorkspaceId(request);

    // 先删除子条目（assets → layers → main）
    await db.delete(extractionAssets)
      .where(eq(extractionAssets.extractionId, id));

    await db.delete(extractionLayers)
      .where(eq(extractionLayers.extractionId, id));

    // 再删除主记录
    const result = await db.delete(articleExtractions)
      .where(and(
        eq(articleExtractions.id, id),
        eq(articleExtractions.workspaceId, workspaceId as string)
      ))
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: '提取记录不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ArticleExtraction] 删除失败:', error);
    return NextResponse.json(
      { success: false, error: '删除失败' },
      { status: 500 }
    );
  }
}
