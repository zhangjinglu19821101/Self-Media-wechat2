/**
 * 保存提取结果到素材库 API（两步拆解法适配）
 * POST /api/article-extraction/[id]/save-to-library
 * 
 * 将两步拆解（范式识别+关系型素材）的结果写入 material_library 表
 * 支持选择性保存（可指定只保存某些素材类型）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceId } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { articleExtractions, materialLibrary } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/** V2 关系型素材类型 → 素材库类型映射 */
const MATERIAL_TYPE_MAP: Record<string, string> = {
  misconception: 'case',           // 错误认知 → 案例
  analogy: 'case',                 // 生活类比 → 案例
  case: 'case',                    // 真实案例 → 案例
  data: 'data',                    // 权威数据 → 数据
  golden_sentence: 'quote',        // 金句 → 引用
  hook_sentence: 'opening',        // 钩子句 → 开头素材
  value_reconstruction: 'ending',  // 价值重构 → 结尾素材
};

/** V2 关系型素材类型 → 中文标签 */
const MATERIAL_TYPE_LABELS: Record<string, string> = {
  misconception: '错误认知',
  analogy: '生活类比',
  case: '真实案例',
  data: '权威数据',
  golden_sentence: '金句',
  hook_sentence: '钩子句',
  value_reconstruction: '价值重构',
};

/** V2 关系型素材类型 → 场景类型映射 */
const SCENE_TYPE_MAP: Record<string, string> = {
  misconception: 'misconception',
  analogy: 'analogy',
  case: 'real_case',
  data: 'authority_data',
  golden_sentence: 'golden_sentence',
  hook_sentence: 'hook_sentence',
  value_reconstruction: 'value_reconstruction',
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspaceId = await getWorkspaceId(request);
    const body = await request.json().catch(() => ({}));
    const { selectedTypes } = body as { selectedTypes?: string[] };

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

    // 获取关系型素材数据（优先使用新版字段）
    const relationalMaterials = extraction.relationalMaterials as Array<any> || [];
    
    if (relationalMaterials.length === 0) {
      return NextResponse.json(
        { success: false, error: '该提取记录没有可保存的关系型素材' },
        { status: 400 }
      );
    }

    // 过滤素材类型（如果指定了 selectedTypes）
    const filteredMaterials = selectedTypes && selectedTypes.length > 0
      ? relationalMaterials.filter(m => selectedTypes.includes(m.materialType))
      : relationalMaterials;

    // 将关系型素材转为素材库记录
    const materialValues = filteredMaterials
      .filter((material: any) => material.content && material.content.trim().length > 0)
      .map((material: any) => {
        // 构建素材内容：包含原文、上下文和关系信息
        const contentParts: string[] = [];
        contentParts.push(material.content);
        if (material.precedingText) contentParts.push(`\n[上文] ${material.precedingText}`);
        if (material.followingText) contentParts.push(`\n[下文] ${material.followingText}`);
        if (material.emotion) contentParts.push(`\n[情绪] ${material.emotion}`);
        if (material.relations?.shouldFollow) contentParts.push(`\n[后续应接] ${material.relations.shouldFollow}`);
        if (material.relations?.shouldPrecede) contentParts.push(`\n[前置位置] ${material.relations.shouldPrecede}`);

        // 提取位置信息
        const paragraphIdx = material.position?.paragraphIndex;
        const sentenceIdx = material.position?.sentenceIndex;
        const positionLabel = paragraphIdx !== undefined
          ? `P${paragraphIdx + 1}${sentenceIdx !== undefined ? `-S${sentenceIdx + 1}` : ''}`
          : '?';

        // 合并情绪标签
        const emotionTags: string[] = [];
        if (material.emotion) emotionTags.push(material.emotion);
        if (material.relations?.emotionTransition) emotionTags.push(material.relations.emotionTransition);

        return {
          workspaceId: workspaceId as string,
          title: `[提取] ${MATERIAL_TYPE_LABELS[material.materialType] || material.materialType} - ${positionLabel}`,
          content: contentParts.join(''),
          type: (MATERIAL_TYPE_MAP[material.materialType] || 'case') as any,
          sceneType: SCENE_TYPE_MAP[material.materialType] || material.materialType || null,
          ownerType: 'user' as const,
          sourceType: 'article' as const,
          sourceDesc: extraction.articleTitle || undefined,
          topicTags: material.topicTags || [],
          sceneTags: material.sceneTags || [],
          emotionTags,
          status: 'active',
        };
      });

    if (materialValues.length === 0) {
      return NextResponse.json(
        { success: true, data: { savedCount: 0, message: '没有可保存的有效素材' } }
      );
    }

    // 批量插入素材库（逐条插入避免冲突）
    let savedCount = 0;
    const savedIds: string[] = [];
    for (const value of materialValues) {
      try {
        const [saved] = await db.insert(materialLibrary).values(value).returning();
        savedCount++;
        if (saved?.id) savedIds.push(saved.id);
      } catch (insertErr) {
        console.warn('[ArticleExtraction] 素材插入跳过（可能重复）:', value.title, insertErr);
      }
    }

    console.log(`[ArticleExtraction] 保存 ${savedCount}/${materialValues.length} 条关系型素材到素材库`);

    return NextResponse.json({
      success: true,
      data: {
        savedCount,
        materialIds: savedIds,
        paradigmInfo: extraction.paradigmName
          ? { matchedParadigmName: extraction.paradigmName, matchScore: extraction.paradigmMatchScore ?? 0 }
          : null,
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
