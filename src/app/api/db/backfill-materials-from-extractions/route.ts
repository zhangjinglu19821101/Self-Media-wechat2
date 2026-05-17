/**
 * 数据回填API：将 article_extractions 中的关系型素材批量流转到 material_library
 * GET /api/db/backfill-materials-from-extractions
 * 
 * 解决问题：article_extractions 有91条素材但 material_library 为空（0条）
 * 回填时会完整传递 contextBefore/contextAfter/emotion/relationToPrevious 等去AI化核心字段
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { articleExtractions, materialLibrary } from '@/lib/db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';

/** V2 关系型素材类型 → 中文标签 */
const MATERIAL_TYPE_LABELS: Record<string, string> = {
  misconception: '错误认知',
  analogy: '生活类比',
  case: '真实案例',
  data: '权威数据',
  golden_sentence: '金句',
  fixed_phrase: '固定句式组合',
  personal_fragment: '个人碎片',
};

/** 范式名称/类型 → 范式ID映射 */
const PARADIGM_ID_MAP: Record<string, string> = {
  '标准错位破局范式': 'P001',
  '行业反思范式': 'P002',
  '案例归谬范式': 'P003',
  '本质定义范式': 'P004',
  '热点事件范式': 'P005',
  '产品解读范式': 'P006',
  '个人经历范式': 'P007',
  '避坑指南范式': 'P008',
  '对比分析范式': 'P009',
  '年终总结范式': 'P010',
  'misconception_break': 'P001',
  'industry_reflection': 'P002',
  'case_refutation': 'P003',
  'essential_definition': 'P004',
  'hot_event': 'P005',
  'product_review': 'P006',
  'personal_experience': 'P007',
  'pitfall_guide': 'P008',
  'comparison_analysis': 'P009',
  'year_end_review': 'P010',
};

/** 使用意图映射 */
const USAGE_INTENT_MAP: Record<string, string> = {
  misconception: '破除读者常见的错误认知，制造认知冲突',
  analogy: '用生活化的比喻让复杂概念变得易懂',
  case: '用真实案例建立信任感和代入感',
  data: '用权威数据增强说服力和可信度',
  golden_sentence: '用精炼的金句制造记忆点和传播点',
  fixed_phrase: '用熟悉的表达方式制造亲切感',
  personal_fragment: '用个人经历增加真实感和独特性',
};

export async function GET(request: NextRequest) {
  try {
    const db = getDatabase();

    // 1. 查询所有 article_extractions
    const extractions = await db
      .select({
        id: articleExtractions.id,
        articleTitle: articleExtractions.articleTitle,
        paradigmName: articleExtractions.paradigmName,
        paradigmType: articleExtractions.paradigmType,
        paradigmMatchScore: articleExtractions.paradigmMatchScore,
        relationalMaterials: articleExtractions.relationalMaterials,
        workspaceId: articleExtractions.workspaceId,
        coreTheme: articleExtractions.coreTheme,
        emotionTone: articleExtractions.emotionTone,
      })
      .from(articleExtractions);

    console.log(`[Backfill] 找到 ${extractions.length} 条提取记录`);

    let totalInserted = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const errors: string[] = [];

    // 2. 逐条提取记录处理
    for (const extraction of extractions) {
      const materials = extraction.relationalMaterials as Array<any> || [];
      if (materials.length === 0) {
        console.log(`[Backfill] 提取记录 ${extraction.id} 无素材，跳过`);
        totalSkipped++;
        continue;
      }

      const matchedParadigmId = PARADIGM_ID_MAP[extraction.paradigmName || '']
        || PARADIGM_ID_MAP[extraction.paradigmType || '']
        || null;

      // 3. 逐条素材处理
      for (const material of materials) {
        if (!material.content || material.content.trim().length === 0) {
          totalSkipped++;
          continue;
        }

        const materialType = material.materialType || 'personal_fragment';
        const typeLabel = MATERIAL_TYPE_LABELS[materialType] || materialType;
        const positionLabel = material.position !== undefined
          ? `P${material.position + 1}`
          : '?';

        const slotId = matchedParadigmId && material.position !== undefined
          ? `${matchedParadigmId}-${String(material.position + 1).padStart(2, '0')}`
          : null;

        try {
          await db.insert(materialLibrary).values({
            workspaceId: extraction.workspaceId || 'default-workspace',
            title: `[提取] ${typeLabel} - ${positionLabel}`,
            content: material.content,
            type: materialType as any,
            sceneType: materialType,
            ownerType: 'user',
            sourceType: 'article',
            sourceDesc: extraction.articleTitle || undefined,
            topicTags: [extraction.coreTheme].filter(Boolean) as any,
            sceneTags: (material.sceneTags || [typeLabel]) as any,
            emotionTags: [extraction.emotionTone, material.emotion].filter(Boolean) as any,
            status: 'active',
            // 🔥 范式位置绑定
            paradigmId: matchedParadigmId,
            paradigmPosition: matchedParadigmId && material.position !== undefined
              ? `${matchedParadigmId}-段落${material.position + 1}`
              : null,
            slotId: slotId,
            // 🔥 去AI化核心字段（完整传递）
            contextBefore: material.contextBefore || null,
            contextAfter: material.contextAfter || null,
            emotion: material.emotion || null,
            relationToPrevious: material.relationToPrevious || null,
            paradigmStep: material.paradigmStep || null,
            usageIntent: USAGE_INTENT_MAP[materialType] || null,
            transitionPhrase: null, // 回填数据不推导衔接句式，留空让后续提取补充
            originalPosition: material.position ?? null,
            analysisText: JSON.stringify({
              extractionId: extraction.id,
              paradigmMatchScore: extraction.paradigmMatchScore,
              version: 'v2-backfill',
            }),
          } as any);
          totalInserted++;
        } catch (insertErr: any) {
          // 忽略唯一约束冲突（可能已存在）
          if (insertErr?.message?.includes('duplicate') || insertErr?.message?.includes('unique')) {
            totalSkipped++;
          } else {
            totalErrors++;
            errors.push(`${typeLabel}-${positionLabel}: ${insertErr?.message?.substring(0, 100)}`);
          }
        }
      }
    }

    const result = {
      success: true,
      data: {
        extractionsProcessed: extractions.length,
        totalInserted,
        totalSkipped,
        totalErrors,
        errors: errors.slice(0, 10), // 最多显示10个错误
        message: `成功回填 ${totalInserted} 条素材到素材库`,
      },
    };

    console.log('[Backfill] 回填完成:', result.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Backfill] 回填失败:', error);
    return NextResponse.json(
      { success: false, error: `回填失败: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
