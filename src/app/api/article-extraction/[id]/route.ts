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

    // 获取关联层和资产数据（兼容旧5层数据）
    const layers = await db.select()
      .from(extractionLayers)
      .where(eq(extractionLayers.extractionId, id));

    const assets = await db.select()
      .from(extractionAssets)
      .where(eq(extractionAssets.extractionId, id));

    // 构造响应：检测是否有V2新格式数据
    const hasNewFormat = !!extraction.paradigmName || !!extraction.relationalMaterials;

    // 计算素材数量（从 relationalMaterials 数组长度）
    const relationalMaterials = extraction.relationalMaterials as Array<unknown> | null;
    const materialCount = Array.isArray(relationalMaterials) ? relationalMaterials.length : (extraction.reusableDimensionCount ?? 0);

    // 从独立字段重构范式识别结果（数据库不存 paradigmRecognition JSON，而是存独立字段）
    const paradigmRecognition = extraction.paradigmName ? {
      matchedParadigmId: extraction.paradigmType || '',
      matchedParadigmName: extraction.paradigmName || '',
      matchScore: extraction.paradigmMatchScore ?? 0,
      structureDifference: extraction.paradigmDiffNote || '',
      matchDetails: {
        structureOrder: 0,
        transitionPhrases: 0,
        emotionCurve: 0,
        paragraphRules: 0,
        articleType: 0,
      },
      structureMapping: [],
    } : null;

    return NextResponse.json({
      success: true,
      data: {
        ...extraction,
        layers,
        assets,
        // 新格式：范式识别 + 7维关系型素材
        paradigmRecognition,
        relationalMaterials: relationalMaterials || null,
        paradigmName: extraction.paradigmName || null,
        paradigmMatchScore: extraction.paradigmMatchScore ?? null,
        extractionSummary: extraction.extractionSummary || '',
        assetValueScore: extraction.assetValueScore ?? 0,
        materialCount,
        // 兼容旧5层格式
        extraction: hasNewFormat ? null : {
          layer1: extraction.layer1Data || (layers.find(l => l.layerName === 'meta_info')?.extractionData) || {},
          layer2: extraction.layer2Data || (layers.find(l => l.layerName === 'core_logic')?.extractionData) || {},
          layer3: extraction.layer3Data || (layers.find(l => l.layerName === 'content_module')?.extractionData) || {},
          layer4: extraction.layer4Data || (layers.find(l => l.layerName === 'language_style')?.extractionData) || {},
          layer5: extraction.layer5Data || (layers.find(l => l.layerName === 'atomic_material')?.extractionData) || {},
          extractionSummary: extraction.extractionSummary || '',
          assetValueScore: extraction.assetValueScore ?? 0,
          reusableDimensionCount: extraction.reusableDimensionCount ?? 0,
        },
      },
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
