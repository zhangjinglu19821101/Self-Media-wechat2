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

/** V2 关系型素材类型 → 素材库类型映射（直接一一对应，无需转换） */
const MATERIAL_TYPE_MAP: Record<string, string> = {
  misconception: 'misconception',   // 错误认知
  analogy: 'analogy',               // 生活类比
  case: 'case',                     // 真实案例
  data: 'data',                     // 权威数据
  golden_sentence: 'golden_sentence', // 金句
  fixed_phrase: 'fixed_phrase',     // 固定句式组合
  personal_fragment: 'personal_fragment', // 个人碎片
};

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

/** V2 关系型素材类型 → 场景类型映射 */
const SCENE_TYPE_MAP: Record<string, string> = {
  misconception: 'misconception',
  analogy: 'analogy',
  case: 'case',
  data: 'data',
  golden_sentence: 'golden_sentence',
  fixed_phrase: 'fixed_phrase',
  personal_fragment: 'personal_fragment',
};

/** 🔥 范式名称/类型 → 范式ID映射（位置ID三重绑定所需） */
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
  // 兼容 paradigmType 字段值
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
        // 🔥 关键修改：素材内容保持纯净，上下文信息存储到专门字段
        // 原因：LLM 需要知道"这个素材是什么"和"如何使用这个素材"是两个独立的信息
        const pureContent = material.content;

        // 提取位置信息
        const paragraphIdx = material.position?.paragraphIndex;
        const sentenceIdx = material.position?.sentenceIndex;
        const positionLabel = paragraphIdx !== undefined
          ? `P${paragraphIdx + 1}${sentenceIdx !== undefined ? `-S${sentenceIdx + 1}` : ''}`
          : '?';

        // 🔥 位置ID三重绑定：自动计算 slotId
        // 规则：如果文章匹配了范式ID，则素材的slotId = 范式ID + "-0" + (段落序号)
        // 例如：范式P001的第1段 → slotId = "P001-01"
        const matchedParadigmId = (extraction as any).paradigmId
          || PARADIGM_ID_MAP[extraction.paradigmName || '']
          || PARADIGM_ID_MAP[extraction.paradigmType || '']
          || null;
        // 🔥 位置ID推导：优先使用 position.paragraphIndex，兜底使用 paradigmStep 映射
        // paradigmStep 是 LLM 提取的步骤标签（如"错误认知"、"核心论点"），
        // 它比 paragraphIndex 更稳定（LLM 不一定输出 position，但一定会输出 paradigmStep）
        const PARADIGM_STEP_SLOT_MAP: Record<string, string> = {
          '错误认知': '01', '核心论点': '02', '核心锚点': '02',
          '案例引入': '03', '案例论证': '03', '案例归谬': '03',
          '数据支撑': '04', '权威数据': '04', '数据论证': '04',
          '类比阐释': '05', '生活类比': '05', '类比论证': '05',
          '金句升华': '06', '金句点睛': '06', '核心金句': '06',
          '固定句式': '07', '固定句式组合': '07',
          '个人碎片': '08', '个人经历': '08', '个人感悟': '08',
          '转折推进': '09', '情感共鸣': '10', '结尾升华': '11',
          '开篇引入': '01', '认知反转': '02', '论证展开': '04',
          '情绪承接': '05', '总结收束': '11',
        };

        const stepSlotNumber = PARADIGM_STEP_SLOT_MAP[material.paradigmStep || '']
          || PARADIGM_STEP_SLOT_MAP[material.materialType || '']
          || (paragraphIdx !== undefined ? String(paragraphIdx + 1).padStart(2, '0') : null);

        const slotId = matchedParadigmId && stepSlotNumber
          ? `${matchedParadigmId}-${stepSlotNumber}`
          : null;

        // 🔥 位置ID三重绑定：自动计算 paradigmPosition
        const paradigmPosition = matchedParadigmId && stepSlotNumber
          ? `${matchedParadigmId}-步骤${stepSlotNumber}(${material.paradigmStep || material.materialType})`
          : null;

        // 合并情绪标签
        const emotionTags: string[] = [];
        if (material.emotion) emotionTags.push(material.emotion);
        if (material.relations?.emotionTransition) emotionTags.push(material.relations.emotionTransition);

        // 🔥 推导使用意图（基于素材类型）
        const usageIntentMap: Record<string, string> = {
          misconception: '破除读者常见的错误认知，制造认知冲突',
          analogy: '用生活化的比喻让复杂概念变得易懂',
          case: '用真实案例建立信任感和代入感',
          data: '用权威数据增强说服力和可信度',
          golden_sentence: '用精炼的金句制造记忆点和传播点',
          fixed_phrase: '用熟悉的表达方式制造亲切感',
          personal_fragment: '用个人经历增加真实感和独特性',
        };

        // 🔥 推导衔接句式（优先使用原文提取，不用随机固定句式——后者本身就是AI特征）
        const materialType = material.materialType || 'personal_fragment';
        
        // 优先级：LLM提取的真实衔接句 > contextBefore末尾句子 > 类型默认衔接模式
        let selectedTransition: string | null = null;
        
        // 1. 优先使用 LLM 从原文提取的真实衔接短语
        if (material.transitionPhrase && material.transitionPhrase.trim()) {
          selectedTransition = material.transitionPhrase.trim();
        }
        // 2. 从 contextBefore 末尾提取真实衔接句（取最后一个完整句子）
        else if (material.contextBefore && material.contextBefore.trim()) {
          const beforeText = material.contextBefore.trim();
          const sentences = beforeText.split(/[。！？；\n]/).filter((s: string) => s.trim().length > 0);
          if (sentences.length > 0) {
            const lastSentence = sentences[sentences.length - 1].trim();
            // 只取较短的衔接句（≤30字），避免截取过长内容
            selectedTransition = lastSentence.length <= 30 ? lastSentence : null;
          }
        }
        // 3. 兜底：使用该素材类型的典型衔接模式（标注为"典型模式"以便下游区分）
        if (!selectedTransition) {
          const defaultTransitionMap: Record<string, string> = {
            misconception: '【典型模式】很多人以为...',
            analogy: '【典型模式】这就好比...',
            case: '【典型模式】说个真实的例子...',
            data: '【典型模式】根据数据显示...',
            golden_sentence: '【典型模式】有句话说得好...',
            fixed_phrase: '【典型模式】说实话...',
            personal_fragment: '【典型模式】我自己就遇到过...',
          };
          selectedTransition = defaultTransitionMap[materialType] || null;
        }

        // 🔥 推导范式步骤（基于段落位置和范式类型）
        const paradigmStepMap: Record<string, string[]> = {
          'P001': ['场景引入', '误认知破除', '反转破局', '数据支撑', '行动建议'],
          'P002': ['行业痛点', '问题剖析', '反思展开', '解决方案', '警示总结'],
          'P003': ['案例背景', '问题出现', '归谬推理', '教训提炼', '避坑建议'],
          'P004': ['概念引入', '本质剖析', '深度解读', '实践指导', '总结升华'],
          'P005': ['事件概述', '关键转折', '深度分析', '启示提炼', '行动指引'],
          'P006': ['产品背景', '核心特点', '优势分析', '适用场景', '购买建议'],
          'P007': ['经历开场', '关键转折', '心路历程', '感悟分享', '经验总结'],
          'P008': ['踩坑背景', '问题揭示', '原因分析', '正确做法', '避坑提醒'],
          'P009': ['对比背景', '维度一对比', '维度二对比', '综合分析', '选择建议'],
          'P010': ['年度回顾', '关键事件', '数据分析', '经验总结', '展望未来'],
        };

        let paradigmStep: string | null = null;
        if (matchedParadigmId && paragraphIdx !== undefined) {
          const steps = paradigmStepMap[matchedParadigmId] || [];
          paradigmStep = steps[paragraphIdx] || `段落${paragraphIdx + 1}`;
        }

        // 🔥 P0-1修复：标题从素材内容中提取有意义的摘要，不再使用占位符
        const typeLabel = MATERIAL_TYPE_LABELS[material.materialType] || material.materialType || '素材';
        const contentPreview = pureContent.replace(/\n/g, ' ').trim().slice(0, 40);
        const meaningfulTitle = pureContent.length > 40
          ? `${typeLabel}: ${contentPreview}...`
          : `${typeLabel}: ${contentPreview}`;

        return {
          workspaceId: workspaceId as string,
          title: meaningfulTitle,
          content: pureContent,  // 🔥 素材内容保持纯净，不再混入上下文
          type: (MATERIAL_TYPE_MAP[material.materialType] || 'personal_fragment') as any,
          sceneType: SCENE_TYPE_MAP[material.materialType] || material.materialType || null,
          ownerType: 'user' as const,
          sourceType: 'article' as const,
          sourceDesc: extraction.articleTitle || undefined,
          topicTags: material.topicTags || [],
          sceneTags: material.sceneTags || [],
          emotionTags,
          status: 'active',
          // 🔥 位置ID三重绑定：素材初始化时即绑定范式和位置
          paradigmId: matchedParadigmId || null,      // 绑定范式ID
          paradigmPosition: paradigmPosition,          // 绑定范式段落位置
          slotId: slotId,                              // 绑定位置ID（如 P001-01）
          
          // 🔥 关系型素材上下文（去AI化核心字段）
          contextBefore: material.contextBefore || material.precedingText || null,           // 前一句原文
          contextAfter: material.contextAfter || material.followingText || null,            // 后一句原文
          emotion: material.emotion || null,                       // 情绪标签（共情/理性/警示/温情/专业/中性）
          relationToPrevious: material.relationToPrevious || material.relations?.shouldPrecede || null, // 与前一个素材的关系
          paradigmStep: material.paradigmStep || paradigmStep,                    // 范式步骤（优先使用提取值）
          usageIntent: usageIntentMap[materialType] || null,       // 使用意图
          transitionPhrase: selectedTransition,                    // 衔接句式
          originalPosition: paragraphIdx ?? null,                  // 原文段落索引
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
