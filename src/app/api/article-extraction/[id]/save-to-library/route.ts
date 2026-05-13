/**
 * 保存提取结果到素材库 API
 * POST /api/article-extraction/[id]/save-to-library
 * 
 * 将5层21维提取结果中可复用的素材写入 material_library 表
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceId } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { articleExtractions, extractionAssets, materialLibrary } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/** 提取维度 → 素材类型映射 */
const DIMENSION_TO_MATERIAL_TYPE: Record<string, string> = {
  // 第五层：原子素材
  misconceptions: 'case',
  lifeAnalogies: 'case',
  realCases: 'case',
  authorityData: 'data',
  goldenSentences: 'quote',
  // 第三层：内容模块
  hookIntro: 'opening',
  emotionalAcceptance: 'opening',
  cognitiveBreakthrough: 'opening',
  plainExplanation: 'opening',
  valueReconstruction: 'opening',
  closingElevation: 'ending',
  // 第二层：核心逻辑
  coreArgument: 'quote',
  breakthroughLogic: 'quote',
  argumentStructure: 'quote',
  valueProposition: 'quote',
  actionGuide: 'ending',
  // 第一层：元信息
  articleTitle: 'case',
  articleType: 'data',
  coreTheme: 'data',
  targetAudience: 'data',
  emotionalTone: 'data',
  publishPlatform: 'data',
  // 第四层：语言风格
  fixedPatterns: 'quote',
  toneCharacteristics: 'quote',
  catchphrases: 'quote',
  forbiddenWords: 'quote',
  paragraphRhythm: 'quote',
};

/** 提取维度 → 场景类型映射 */
const DIMENSION_TO_SCENE_TYPE: Record<string, string> = {
  // 第五层：原子素材
  misconceptions: 'misconception',
  lifeAnalogies: 'analogy',
  realCases: 'real_case',
  authorityData: 'authority_data',
  goldenSentences: 'golden_sentence',
  // 第三层：内容模块
  hookIntro: 'opening_hook',
  emotionalAcceptance: 'emotion_acceptance',
  cognitiveBreakthrough: 'misconception',
  plainExplanation: 'analogy',
  valueReconstruction: 'value_reconstruction',
  closingElevation: 'closing_elevation',
  // 第二层：核心逻辑
  coreArgument: 'analogy',
  breakthroughLogic: 'misconception',
  argumentStructure: 'analogy',
  valueProposition: 'value_reconstruction',
  actionGuide: 'action_guide',
  // 第四层：语言风格
  fixedPatterns: 'style_pattern',
  toneCharacteristics: 'style_pattern',
  catchphrases: 'catchphrase',
  forbiddenWords: 'style_pattern',
  paragraphRhythm: 'style_pattern',
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspaceId = await getWorkspaceId(request);

    // 查询提取记录
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

    // 查询提取的数字资产
    const assets = await db.select()
      .from(extractionAssets)
      .where(eq(extractionAssets.extractionId, id));

    if (assets.length === 0) {
      return NextResponse.json(
        { success: false, error: '该提取记录没有可保存的资产' },
        { status: 400 }
      );
    }

    // 将数字资产转为素材库记录
    const materialValues = assets
      .filter(asset => asset.assetContent && asset.assetContent.trim().length > 0)
      .map(asset => ({
        workspaceId: workspaceId as string,
        title: `[提取] ${asset.assetName} - ${asset.dimensionName}`,
        content: asset.assetContent,
        type: DIMENSION_TO_MATERIAL_TYPE[asset.dimensionName] || 'case',
        sceneType: DIMENSION_TO_SCENE_TYPE[asset.dimensionName] || null,
        ownerType: 'user' as const,
        sourceType: 'article_extraction' as const,
        sourceDesc: extraction.articleTitle || undefined,
      }));

    if (materialValues.length === 0) {
      return NextResponse.json(
        { success: true, data: { savedCount: 0, message: '没有可保存的有效素材' } }
      );
    }

    // 批量插入素材库
    const savedMaterials = await db.insert(materialLibrary).values(materialValues).returning();

    console.log(`[ArticleExtraction] 保存 ${savedMaterials.length} 条素材到素材库`);

    return NextResponse.json({
      success: true,
      data: {
        savedCount: savedMaterials.length,
        materialIds: savedMaterials.map(m => m.id),
      },
    });
  } catch (error) {
    console.error('[ArticleExtraction] 保存到素材库失败:', error);
    return NextResponse.json(
      { success: false, error: `保存失败: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
