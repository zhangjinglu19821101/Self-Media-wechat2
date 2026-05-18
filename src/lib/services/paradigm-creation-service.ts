/**
 * 范式创作服务
 * 实现「10套固定范式 + 5大素材库」创作体系
 * 
 * 核心流程：
 * 1. 范式识别 → 根据任务匹配范式
 * 2. 素材匹配 → 按范式位置映射查找素材
 * 3. 原位填充 → 将素材填入范式固定位置
 * 4. 衔接优化 → 仅做衔接词微调，不改核心内容
 * 5. 小红书适配 → 按范式小红书版结构适配格式
 */

import { db } from '@/lib/db';
import { paradigmLibrary } from '@/lib/db/schema/paradigm-library';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { eq, and, or, desc, asc, sql, lte, notInArray } from 'drizzle-orm';
import { PARADIGM_SEED_DATA, PARADIGM_CODE_NAME_MAP, PARADIGM_ARTICLE_TYPE_MAP } from '@/lib/db/schema/paradigm-seed-data';
import { ParadigmSlotManager } from '@/lib/services/paradigm-slot-manager';

// ============================================================
// 类型定义
// ============================================================

/** 范式识别结果 */
export interface ParadigmRecognitionResult {
  paradigmCode: string;           // 匹配的范式ID（如 P001）
  paradigmName: string;           // 范式名称
  confidence: number;             // 匹配置信度 0~1
  matchReason: string;            // 匹配原因
  matchedKeywords: string[];      // 匹配到的关键词
  fallbackParadigm?: string;      // 降级范式（置信度不足时）
}

/** 素材匹配结果 */
export interface MaterialMatchResult {
  materialId: string;
  title: string;
  content: string;
  materialType: string;           // 素材类型：analogy/misconception/case/data/fixed_phrase/golden_sentence/personal_fragment
  paradigmPosition: string;       // 在范式中的位置（如 "P001-段落1"）
  slotId?: string;                // 🔥 位置ID三重绑定：素材绑定的位置ID（如 "P001-01"）
  score: number;                  // 匹配得分
  hasPreContext: boolean;          // 是否有前文关系
  hasPostContext: boolean;         // 是否有后文关系
}

/** 段落填充结果 */
export interface ParagraphFillResult {
  order: number;
  stepName: string;
  titleTemplate: string;
  filledContent: string;           // 填充后的段落内容
  usedMaterialIds: string[];       // 使用的素材ID列表
  isPrimarySlot: boolean;          // 是否是主素材槽位
}

/** 文章填充结果 */
export interface ArticleFillResult {
  paradigmCode: string;
  paradigmName: string;
  paragraphs: ParagraphFillResult[];
  fullArticle: string;             // 完整文章内容
  usedMaterialIds: string[];       // 所有使用的素材ID
  emotionCurve: { order: number; stepName: string; emotion: string; intensity: number }[];
}

/** 小红书适配结果 */
export interface XhsAdaptResult {
  paradigmCode: string;
  paradigmName: string;
  sections: {
    order: number;
    stepName: string;
    content: string;
    emojiSuggestions: string[];
  }[];
  fullContent: string;
}

/** 衔接优化结果 */
export interface ConnectiveOptimizeResult {
  optimizedArticle: string;
  changes: {
    position: string;
    original: string;
    optimized: string;
    type: 'connective' | 'personal_fragment' | 'tone_adjust';
  }[];
}

// ============================================================
// 范式识别 Agent
// ============================================================

/**
 * 根据任务信息识别匹配的范式
 * 优先级：文章类型精确匹配 > 关键词匹配 > 降级为P001
 */
export async function recognizeParadigm(params: {
  articleType?: string;           // 文章类型（如 "客户误区型"）
  industry?: string;              // 行业标识
  topic?: string;                 // 创作主题
  taskDescription?: string;       // 任务描述
}): Promise<ParadigmRecognitionResult> {
  const { articleType, industry, topic, taskDescription } = params;
  
  // 1. 加载所有活跃范式
  const paradigms = await db
    .select()
    .from(paradigmLibrary)
    .where(eq(paradigmLibrary.isActive, true))
    .orderBy(asc(paradigmLibrary.sortOrder));

  if (paradigms.length === 0) {
    // 如果数据库没有范式，使用内存中的种子数据
    return recognizeParadigmFromSeed(params);
  }

  let bestMatch: ParadigmRecognitionResult | null = null;

  // 2. 优先按文章类型精确匹配
  if (articleType) {
    for (const p of paradigms) {
      const types = (p.applicableArticleTypes as string[]) || [];
      if (types.includes(articleType)) {
        return {
          paradigmCode: p.paradigmCode,
          paradigmName: p.paradigmName,
          confidence: 1.0,
          matchReason: `文章类型「${articleType}」精确匹配范式「${p.paradigmName}」`,
          matchedKeywords: [articleType],
        };
      }
    }
  }

  // 3. 按关键词匹配
  const searchText = [topic, taskDescription, articleType].filter(Boolean).join(' ');
  if (searchText) {
    let bestScore = 0;
    for (const p of paradigms) {
      const keywords = (p.applicableSceneKeywords as string[]) || [];
      const matchedKw = keywords.filter(kw => searchText.includes(kw));
      const score = matchedKw.length / Math.max(keywords.length, 1);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          paradigmCode: p.paradigmCode,
          paradigmName: p.paradigmName,
          confidence: Math.min(score * 2, 0.95), // 放大置信度，上限0.95
          matchReason: `关键词匹配：${matchedKw.join('、')}`,
          matchedKeywords: matchedKw,
          fallbackParadigm: 'P001',
        };
      }
    }
  }

  // 4. 按行业匹配（如果关键词匹配不够）
  if ((!bestMatch || bestMatch.confidence < 0.3) && industry) {
    for (const p of paradigms) {
      const industries = (p.applicableIndustries as string[]) || [];
      if (industries.includes(industry)) {
        const score = 0.4;
        if (!bestMatch || score > bestMatch.confidence) {
          bestMatch = {
            paradigmCode: p.paradigmCode,
            paradigmName: p.paradigmName,
            confidence: score,
            matchReason: `行业「${industry}」匹配`,
            matchedKeywords: [industry],
            fallbackParadigm: 'P001',
          };
        }
      }
    }
  }

  // 5. 降级为P001（标准错位破局范式，覆盖面最广）
  if (!bestMatch || bestMatch.confidence < 0.8) {
    const p001 = paradigms.find(p => p.paradigmCode === 'P001');
    if (bestMatch && bestMatch.confidence >= 0.3) {
      // 置信度在 30%~80% 之间，使用匹配结果但提示降级
      bestMatch.fallbackParadigm = 'P001';
      return bestMatch;
    }
    return {
      paradigmCode: p001?.paradigmCode || 'P001',
      paradigmName: p001?.paradigmName || '标准错位破局范式',
      confidence: 0.3,
      matchReason: '未匹配到明确范式，降级为通用范式（标准错位破局范式）',
      matchedKeywords: [],
      fallbackParadigm: 'P001',
    };
  }

  return bestMatch;
}

/** 使用内存种子数据的范式识别（数据库无范式时兜底） */
function recognizeParadigmFromSeed(params: {
  articleType?: string;
  industry?: string;
  topic?: string;
  taskDescription?: string;
}): ParadigmRecognitionResult {
  const { articleType, industry, topic, taskDescription } = params;

  // 按文章类型匹配
  if (articleType) {
    for (const p of PARADIGM_SEED_DATA) {
      if ((p.applicableArticleTypes as readonly string[]).includes(articleType)) {
        return {
          paradigmCode: p.paradigmCode,
          paradigmName: p.paradigmName,
          confidence: 1.0,
          matchReason: `文章类型「${articleType}」精确匹配范式「${p.paradigmName}」`,
          matchedKeywords: [articleType],
        };
      }
    }
  }

  // 按关键词匹配
  const searchText = [topic, taskDescription, articleType].filter(Boolean).join(' ');
  if (searchText) {
    let bestScore = 0;
    let bestP: typeof PARADIGM_SEED_DATA[number] = PARADIGM_SEED_DATA[0];
    let matchedKw: string[] = [];
    for (const p of PARADIGM_SEED_DATA) {
      const kw = p.applicableSceneKeywords.filter(k => searchText.includes(k));
      const score = kw.length / Math.max(p.applicableSceneKeywords.length, 1);
      if (score > bestScore) {
        bestScore = score;
        bestP = p;
        matchedKw = kw;
      }
    }
    if (bestScore > 0) {
      return {
        paradigmCode: bestP.paradigmCode,
        paradigmName: bestP.paradigmName,
        confidence: Math.min(bestScore * 2, 0.95),
        matchReason: `关键词匹配：${matchedKw.join('、')}`,
        matchedKeywords: matchedKw,
        fallbackParadigm: 'P001',
      };
    }
  }

  // 降级P001
  return {
    paradigmCode: 'P001',
    paradigmName: '标准错位破局范式',
    confidence: 0.3,
    matchReason: '未匹配到明确范式，降级为通用范式',
    matchedKeywords: [],
    fallbackParadigm: 'P001',
  };
}

// ============================================================
// 素材匹配 Agent
// ============================================================

/** 素材类型映射：sceneType → 范式素材类型 */
const SCENE_TYPE_TO_MATERIAL_TYPE: Record<string, string> = {
  analogy: 'analogy',             // 类比
  mistake: 'misconception',       // 误区 → 错误认知
  misconception: 'misconception', // 错误认知
  regulation: 'data',             // 法规 → 数据佐证
  event: 'case',                  // 事件 → 案例
  case: 'case',                   // 案例
  data: 'data',                   // 数据
  fixed_phrase: 'fixed_phrase',   // 固定句式
  golden_sentence: 'golden_sentence', // 金句
  personal_fragment: 'personal_fragment', // 个人碎片
};

/**
 * 按范式位置映射匹配素材
 * 
 * 🔥 严格绑定规则（V2 - 范式与素材强绑定）：
 * 1. 选定范式后，素材范围严格限定在属于该范式的素材（paradigmId 匹配）
 * 2. 每个槽位只允许对应 slotId 的素材（slotId 精确匹配）
 * 3. 不属于当前范式的素材不出现在可选清单
 * 4. 防重复：7天内不重复使用同一素材
 * 5. 优先使用次数少的素材
 * 
 * ❌ 已移除的旧策略：
 * - 旧策略2（按 sceneType 匹配）：不限制范式，会引入不相关素材
 * - 旧策略3（按 topicTags 匹配）：不限制范式，会引入不相关素材
 */
export async function matchMaterials(params: {
  paradigmCode: string;           // 范式ID
  industry?: string;              // 行业（仅用于素材排序偏好，不影响筛选范围）
  topicTags?: string[];           // 主题标签（仅用于素材排序偏好，不影响筛选范围）
  excludeIds?: string[];          // 排除的素材ID（防重复）
  paradigmPositionMap?: any[];    // 范式的素材位置映射
  /** 🔥 用户素材已填充的段落序号（跳过这些段落，避免重复填充） */
  userFilledParagraphOrders?: number[];
  /** 🔥 用户素材ID列表（从自动匹配中排除，避免与用户素材重复） */
  userMaterialIds?: string[];
}): Promise<Map<number, MaterialMatchResult[]>> {
  const { paradigmCode, excludeIds = [], paradigmPositionMap, userFilledParagraphOrders = [], userMaterialIds = [] } = params;
  
  const result = new Map<number, MaterialMatchResult[]>();
  
  // 获取范式位置映射
  const positionMap = paradigmPositionMap || await getParadigmPositionMap(paradigmCode);
  if (!positionMap || positionMap.length === 0) {
    console.warn(`[matchMaterials] 范式 ${paradigmCode} 无素材位置映射`);
    return result;
  }

  // 🔥 校验：获取范式有效 slotId 集合
  const validSlotIds = ParadigmSlotManager.getValidSlotIds(paradigmCode);
  if (validSlotIds.length === 0) {
    console.warn(`[matchMaterials] 范式 ${paradigmCode} 无有效槽位定义`);
    return result;
  }
  console.log(`[matchMaterials] 范式 ${paradigmCode} 有效槽位: [${validSlotIds.join(', ')}]`);

  // 7天前的时间戳
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  for (const slot of positionMap) {
    const materials: MaterialMatchResult[] = [];
    const paragraphOrder = slot.paragraphOrder as number;
    const slotId = slot.slotId as string;

    // 🔥 跳过用户素材已填充的段落（用户素材优先，系统素材补位）
    if (userFilledParagraphOrders.includes(paragraphOrder)) {
      console.log(`[matchMaterials] 段落${paragraphOrder}已由用户素材填充，跳过自动匹配`);
      continue;
    }

    // 🔥 校验：slotId 必须属于当前范式的有效槽位
    if (!slotId || !ParadigmSlotManager.isValidSlotId(paradigmCode, slotId)) {
      console.warn(`[matchMaterials] ⚠️ 槽位 ${slotId} 不属于范式 ${paradigmCode} 的有效槽位，跳过`);
      continue;
    }

    // 🔥 合并排除ID：原有排除 + 用户素材ID
    const allExcludeIds = [...excludeIds, ...userMaterialIds];

    // ============================================================
    // 策略1（最高优先级）：🔥 范式+slotId 双重精确匹配
    // 条件：paradigmId = paradigmCode AND slotId = slotId
    // ============================================================
    const slotIdMatches = await db
      .select()
      .from(materialLibrary)
      .where(
        and(
          eq(materialLibrary.status, 'active'),
          eq(materialLibrary.paradigmId, paradigmCode),  // 🔥 范式限定
          eq(materialLibrary.slotId, slotId),             // 🔥 槽位限定
          or(
            sql`${materialLibrary.lastUsedAt} IS NULL`,
            sql`${materialLibrary.lastUsedAt} <= ${sevenDaysAgo}`
          ),
          ...buildExcludeCondition(allExcludeIds)
        )
      )
      .orderBy(asc(materialLibrary.useCount))
      .limit(5);

    for (const m of slotIdMatches) {
      materials.push({
        materialId: m.id,
        title: m.title,
        content: m.content || '',
        materialType: m.sceneType || m.type,
        paradigmPosition: m.paradigmPosition || '',
        slotId: m.slotId || slotId,
        score: 1.0, // 范式+slotId 双重匹配 = 最高优先级
        hasPreContext: !!(m.sceneTags as string[])?.some(t => t === '承接' || t === '过渡'),
        hasPostContext: !!(m.sceneTags as string[])?.some(t => t === '引出' || t === '铺垫'),
      });
    }

    // ============================================================
    // ⚠️ 已移除的策略2/3/4：
    // ❌ 旧策略2（paradigmPosition 兜底匹配）：旧数据没有 slotId，无法确定精确位置
    // ❌ 旧策略3（按 sceneType 匹配）：不限制范式，会引入不相关素材
    // ❌ 旧策略4（按 topicTags 匹配）：不限制范式，会引入不相关素材
    //
    // 🔥 严格绑定原则：
    // - 选定范式后，素材范围严格限定在属于该范式的素材
    // - slotId确定后，只允许对应slotId位置的素材可选
    // - 不匹配的素材绝对不能出现在可选清单
    // - 如果某槽位无素材，标记为"素材缺失"而非引入不相关素材
    // ============================================================

    // 🔥 日志：槽位素材匹配结果
    if (materials.length === 0) {
      console.warn(`[matchMaterials] ⚠️ 槽位 ${slotId}（段落${paragraphOrder}）无可用素材！该槽位素材缺失。`);
    } else {
      console.log(`[matchMaterials] ✅ 槽位 ${slotId}（段落${paragraphOrder}）匹配 ${materials.length} 条素材，最优="${materials[0].title?.substring(0,20)}..." score=${materials[0].score}`);
    }

    result.set(paragraphOrder, materials);
  }

  // 🔥 最终校验：检查是否有必填槽位素材缺失
  const { missing, hasMissingRequired } = ParadigmSlotManager.detectMissingSlots(
    paradigmCode,
    Array.from(result.entries())
      .filter(([, mats]) => mats.length > 0)
      .map(([order]) => {
        const slot = positionMap.find((s: any) => s.paragraphOrder === order);
        return slot?.slotId as string;
      })
      .filter(Boolean)
  );

  if (hasMissingRequired) {
    const warning = ParadigmSlotManager.generateMissingSlotsWarning(paradigmCode, missing);
    console.warn(`[matchMaterials] ${warning}`);
  }

  return result;
}

/** 构建排除ID条件（参数化防注入） */
function buildExcludeCondition(excludeIds: string[]): any[] {
  if (excludeIds.length === 0) return [];
  return [notInArray(materialLibrary.id, excludeIds)];
}

/** 获取范式素材位置映射（导出给API使用） */
export async function getParadigmPositionMap(paradigmCode: string): Promise<any[]> {
  const paradigm = await db
    .select({ materialPositionMap: paradigmLibrary.materialPositionMap })
    .from(paradigmLibrary)
    .where(eq(paradigmLibrary.paradigmCode, paradigmCode))
    .limit(1);

  if (paradigm.length > 0 && paradigm[0].materialPositionMap) {
    return paradigm[0].materialPositionMap as any[];
  }

  // 从种子数据获取
  const seed = PARADIGM_SEED_DATA.find(p => p.paradigmCode === paradigmCode);
  return seed ? [...seed.materialPositionMap] : [];
}

// ============================================================
// 范式原位填充 Agent
// ============================================================

/**
 * 将匹配的素材原位填充到范式结构中
 * 
 * 🔥 V2 严格绑定规则：
 * 1. 只填素材，不写内容（素材是什么就填什么）
 * 2. 严格按位置填充（slotId 精确匹配）
 * 3. 用户手动绑定的素材必须校验范式归属（不属于当前范式的素材拒绝使用）
 * 4. 素材缺失的必填槽位标记为"待补充"，绝不引入不相关素材
 * 5. 防重复调用
 */
export async function fillParadigmArticle(params: {
  paradigmCode: string;
  matchedMaterials: Map<number, MaterialMatchResult[]>;
  paradigmStructure?: any[];      // 范式公众号版结构
  paradigmMaterialBindings?: Record<string, string>; // 🔥 用户手动绑定的素材（slotId → materialId）
}): Promise<ArticleFillResult> {
  const { paradigmCode, matchedMaterials, paradigmMaterialBindings } = params;

  // 获取范式结构
  const structure = params.paradigmStructure || await getParadigmStructure(paradigmCode);
  const positionMap = await getParadigmPositionMap(paradigmCode);
  const emotionCurve = await getParadigmEmotionCurve(paradigmCode);
  const paradigmName = PARADIGM_CODE_NAME_MAP[paradigmCode] || paradigmCode;

  // 🔥 获取范式有效槽位集合
  const validSlotIds = ParadigmSlotManager.getValidSlotIds(paradigmCode);

  const paragraphs: ParagraphFillResult[] = [];
  const allUsedMaterialIds: string[] = [];
  const missingSlotIds: string[] = [];  // 🔥 记录缺失的槽位

  for (const step of structure) {
    const order = step.order as number;
    const materials = matchedMaterials.get(order) || [];

    // 🔥🔥🔥 位置ID三重绑定：优先使用用户手动绑定的素材
    let selectedMaterial: MaterialMatchResult | null = null;
    const slotInfo = positionMap.find((s: any) => s.paragraphOrder === order);
    const slotId = slotInfo?.slotId as string | undefined;

    // 🔥 校验：slotId 必须属于当前范式
    if (!slotId || !ParadigmSlotManager.isValidSlotId(paradigmCode, slotId)) {
      console.warn(`[fillParadigmArticle] ⚠️ 步骤${order}的 slotId="${slotId}" 不属于范式 ${paradigmCode}，跳过`);
      missingSlotIds.push(slotId || `order-${order}`);
      // 推入占位段落
      paragraphs.push({
        order,
        stepName: step.stepName || `步骤${order}`,
        titleTemplate: step.titleTemplate || '',
        filledContent: `【${step.stepName || `步骤${order}`}】槽位ID无效，无法填充`,
        usedMaterialIds: [],
        isPrimarySlot: false,
      });
      continue;
    }

    // 1. 最高优先级：用户手动绑定的素材（通过 paradigmMaterialBindings）
    if (paradigmMaterialBindings && paradigmMaterialBindings[slotId]) {
      const boundMaterialId = paradigmMaterialBindings[slotId];
      
      // 🔥🔥🔥 V2 严格校验：用户绑定的素材必须属于当前范式
      const boundFromDb = await db
        .select()
        .from(materialLibrary)
        .where(eq(materialLibrary.id, boundMaterialId))
        .limit(1);

      if (boundFromDb.length > 0) {
        const m = boundFromDb[0];
        
        // 🔥 校验1：素材的 paradigmId 必须匹配当前范式
        if (m.paradigmId && m.paradigmId !== paradigmCode) {
          console.warn(`[fillParadigmArticle] ❌ 用户绑定素材 "${m.title}" 的 paradigmId="${m.paradigmId}" 与当前范式 "${paradigmCode}" 不匹配，拒绝使用！`);
        }
        // 🔥 校验2：素材的 slotId 必须匹配当前槽位
        else if (m.slotId && m.slotId !== slotId) {
          console.warn(`[fillParadigmArticle] ❌ 用户绑定素材 "${m.title}" 的 slotId="${m.slotId}" 与当前槽位 "${slotId}" 不匹配，拒绝使用！`);
        }
        else {
          // ✅ 校验通过
          selectedMaterial = {
            materialId: m.id,
            title: m.title,
            content: m.content || '',
            materialType: m.sceneType || m.type,
            paradigmPosition: m.paradigmPosition || '',
            slotId: m.slotId || slotId,
            score: 1.0, // 用户手动绑定 = 最高优先级
            hasPreContext: !!(m.sceneTags as string[])?.some((t: string) => t === '承接' || t === '过渡'),
            hasPostContext: !!(m.sceneTags as string[])?.some((t: string) => t === '引出' || t === '铺垫'),
          };
          console.log(`[fillParadigmArticle] ✅ 用户绑定素材(已校验) → 段落${order}(${slotId}): ${m.title}`);
        }
      } else {
        console.warn(`[fillParadigmArticle] ⚠️ 用户绑定的素材ID="${boundMaterialId}" 不存在`);
      }
    }

    // 2. 次优先级：slotId精确匹配的自动素材
    // 🔥 V2：素材已由 matchMaterials 严格限定在当前范式+slotId范围内，无需再次校验
    if (!selectedMaterial) {
      const slotIdMatches = materials.filter(m => m.slotId && m.slotId === slotId);
      if (slotIdMatches.length > 0) {
        // 🔥 同slotId多素材选择策略：按质量排序，选最优
        const sortedByQuality = slotIdMatches.sort((a, b) => {
          // 1. 匹配分数（slotId精确匹配=1.0 > paradigmPosition匹配=0.9）
          if (a.score !== b.score) return b.score - a.score;
          
          // 2. 上下文完整度（有前后文 > 只有一个 > 无上下文）
          const aCtxScore = (a.hasPreContext ? 1 : 0) + (a.hasPostContext ? 1 : 0);
          const bCtxScore = (b.hasPreContext ? 1 : 0) + (b.hasPostContext ? 1 : 0);
          if (aCtxScore !== bCtxScore) return bCtxScore - aCtxScore;
          
          // 3. 有使用指导优先
          const aGuidance = (a as any).usageGuidance ? 1 : 0;
          const bGuidance = (b as any).usageGuidance ? 1 : 0;
          if (aGuidance !== bGuidance) return bGuidance - aGuidance;
          
          // 4. 创建时间优先（新素材优先，避免总是用旧素材）
          return ((b as any).createdAt?.getTime() || 0) - ((a as any).createdAt?.getTime() || 0);
        });
        
        selectedMaterial = sortedByQuality[0];
        
        // 🔥 日志：同slotId多素材选择
        if (slotIdMatches.length > 1) {
          console.log(`[fillParadigmArticle] ⚡ 同slotId多素材选择: slotId=${slotId}, 候选数=${slotIdMatches.length}, 选中="${selectedMaterial.title?.substring(0,20)}..."`);
        }
      }
    }

    // 🔥 V2：移除"降级：自动匹配素材"逻辑
    // 旧逻辑会使用不属于当前slotId的素材，违反了"slotId确定后只有该slotId素材可选"的原则
    // 如果没有对应slotId的素材，就是缺失，应该标记而非用其他素材顶替

    // 构建段落内容
    let filledContent = '';
    const usedIds: string[] = [];

    if (selectedMaterial) {
      // 核心规则：只填素材，不写内容
      filledContent = selectedMaterial.content;
      usedIds.push(selectedMaterial.materialId);
      allUsedMaterialIds.push(selectedMaterial.materialId);

      // 如果是主槽位且有固定句式，可以拼接固定句式前缀
      if (slotInfo?.isPrimary && step.fixedPhrases?.length > 0) {
        // 仅在素材不以固定句式开头时，拼接固定句式
        const startsWithFixed = step.fixedPhrases.some((phrase: string) => 
          selectedMaterial!.content.startsWith(phrase)
        );
        if (!startsWithFixed && selectedMaterial.score < 0.9) {
          filledContent = `${step.fixedPhrases[0]}，${selectedMaterial.content}`;
        }
      }
    } else {
      // 🔥 V2：素材缺失时，明确标记缺失的 slotId
      missingSlotIds.push(slotId);
      const slotDetail = ParadigmSlotManager.getSlotDetail(paradigmCode, slotId);
      const requiredLabel = slotDetail?.required ? '【必填】' : '【可选】';
      
      if (step.fixedPhrases?.length > 0) {
        filledContent = `${step.fixedPhrases[0]}……（⚠️ ${requiredLabel}素材缺失：${slotId}-${step.stepName}）`;
      } else {
        filledContent = `【${step.stepName}】⚠️ ${requiredLabel}素材缺失：${slotId}`;
      }
      console.warn(`[fillParadigmArticle] ⚠️ 槽位 ${slotId}（${step.stepName}）素材缺失！required=${slotDetail?.required}`);
    }

    paragraphs.push({
      order,
      stepName: step.stepName,
      titleTemplate: step.titleTemplate,
      filledContent,
      usedMaterialIds: usedIds,
      isPrimarySlot: positionMap.find((s: any) => s.paragraphOrder === order)?.isPrimary ?? false,
    });
  }

  // 🔥 最终报告：素材缺失情况
  if (missingSlotIds.length > 0) {
    console.warn(`[fillParadigmArticle] ⚠️ 范式 ${paradigmCode} 有 ${missingSlotIds.length} 个槽位素材缺失: [${missingSlotIds.join(', ')}]`);
    console.warn(`[fillParadigmArticle] 💡 建议：请为这些槽位补充素材，否则文章将出现占位标记`);
  } else {
    console.log(`[fillParadigmArticle] ✅ 范式 ${paradigmCode} 所有槽位素材填充完整`);
  }

  // 更新素材使用记录
  await updateMaterialUsage(allUsedMaterialIds);

  // 拼接完整文章
  const fullArticle = paragraphs
    .map(p => `${p.filledContent}`)
    .join('\n\n');

  return {
    paradigmCode,
    paradigmName,
    paragraphs,
    fullArticle,
    usedMaterialIds: allUsedMaterialIds,
    emotionCurve: emotionCurve as any[],
  };
}

/** 获取范式公众号版结构（导出给API使用） */
export async function getParadigmStructure(paradigmCode: string): Promise<any[]> {
  const paradigm = await db
    .select({ officialAccountStructure: paradigmLibrary.officialAccountStructure })
    .from(paradigmLibrary)
    .where(eq(paradigmLibrary.paradigmCode, paradigmCode))
    .limit(1);

  if (paradigm.length > 0 && paradigm[0].officialAccountStructure) {
    return paradigm[0].officialAccountStructure as any[];
  }

  const seed = PARADIGM_SEED_DATA.find(p => p.paradigmCode === paradigmCode);
  return seed ? [...seed.officialAccountStructure] : [];
}

/** 获取范式情绪曲线 */
async function getParadigmEmotionCurve(paradigmCode: string): Promise<any[]> {
  const paradigm = await db
    .select({ emotionCurve: paradigmLibrary.emotionCurve })
    .from(paradigmLibrary)
    .where(eq(paradigmLibrary.paradigmCode, paradigmCode))
    .limit(1);

  if (paradigm.length > 0 && paradigm[0].emotionCurve) {
    return paradigm[0].emotionCurve as any[];
  }

  const seed = PARADIGM_SEED_DATA.find(p => p.paradigmCode === paradigmCode);
  return seed ? [...seed.emotionCurve] : [];
}

/** 更新素材使用记录（标记最后使用时间 + 递增使用次数） */
async function updateMaterialUsage(materialIds: string[]): Promise<void> {
  if (materialIds.length === 0) return;

  for (const id of materialIds) {
    await db
      .update(materialLibrary)
      .set({
        lastUsedAt: new Date(),
        useCount: sql`${materialLibrary.useCount} + 1`,
      })
      .where(eq(materialLibrary.id, id));
  }
}

// ============================================================
// 素材衔接轻优化 Agent
// ============================================================

/** 衔接词替换映射 */
const CONNECTIVE_REPLACEMENTS: Record<string, string[]> = {
  '因此': ['所以啊', '这就是为什么', '说到这'],
  '所以': ['所以说', '这就是', '到头来'],
  '但是': ['不过话说回来', '但你说', '可偏偏'],
  '然而': ['但问题是', '可实际上', '偏偏'],
  '此外': ['还有一点', '另外说一句', '对了'],
  '总之': ['说到底', '归根结底', '到最后'],
  '综上所述': ['说到底', '我总结一下', '最后想说的'],
  '首先': ['先说', '第一件事', '你看'],
  '其次': ['然后', '再说', '还有'],
  '最后': ['最后说一点', '还有件事', '对了'],
  '毋庸置疑': ['说真的', '不夸张地说'],
  '众所周知': ['大家都知道', '其实很多人不知道'],
  '显而易见': ['一眼就能看出', '明摆着'],
  '值得注意的是': ['有个事儿得说说', '注意了'],
  '不可否认': ['确实', '得承认'],
  '与此同时': ['同时', '在这时候'],
  '换言之': ['换句话说', '说白了'],
  '由此可见': ['你看', '这不就说明'],
};

/**
 * 素材衔接轻优化
 * 仅做3件事：
 * 1. 微调衔接词（消除拼接感）
 * 2. 插入1-2个「个人碎片」素材（增强人味）
 * 3. 统一语气（匹配范式情绪节奏）
 * 
 * 不改动任何核心观点和素材内容
 */
export function optimizeConnectives(params: {
  article: string;
  emotionCurve?: { emotion: string; intensity: number }[];
  personalFragments?: string[];   // 可用的个人碎片素材
}): ConnectiveOptimizeResult {
  const { article, emotionCurve, personalFragments = [] } = params;
  
  let optimized = article;
  const changes: ConnectiveOptimizeResult['changes'] = [];

  // 1. 替换AI味衔接词
  for (const [formal, casuals] of Object.entries(CONNECTIVE_REPLACEMENTS)) {
    const regex = new RegExp(formal, 'g');
    const replacement = casuals[Math.floor(Math.random() * casuals.length)];
    const newArticle = optimized.replace(regex, replacement);
    if (newArticle !== optimized) {
      changes.push({
        position: `衔接词「${formal}」→「${replacement}」`,
        original: formal,
        optimized: replacement,
        type: 'connective',
      });
      optimized = newArticle;
    }
  }

  // 2. 插入1-2个个人碎片（括号补充/自嘲）
  if (personalFragments.length > 0) {
    const paragraphs = optimized.split('\n\n');
    const insertPositions = [1, 3]; // 在第2、4段插入
    let fragmentIndex = 0;

    for (const pos of insertPositions) {
      if (pos < paragraphs.length && fragmentIndex < personalFragments.length) {
        const fragment = personalFragments[fragmentIndex];
        // 以括号形式插入，不改变原段结构
        paragraphs[pos] = paragraphs[pos].replace(
          /([。！？])/, 
          `$1（${fragment}）`
        );
        if (paragraphs[pos] !== optimized.split('\n\n')[pos]) {
          changes.push({
            position: `第${pos + 1}段`,
            original: '',
            optimized: `（${fragment}）`,
            type: 'personal_fragment',
          });
          fragmentIndex++;
        }
      }
    }
    optimized = paragraphs.join('\n\n');
  }

  // 3. 语气统一（检查是否有过于正式的表达）
  const toneReplacements: Record<string, string> = {
    '笔者': '我',
    '本人': '我',
    '笔者认为': '我觉得',
    '笔者建议': '我的建议是',
    '读者': '你',
    '广大读者': '大家',
  };

  for (const [formal, casual] of Object.entries(toneReplacements)) {
    const newArticle = optimized.replace(new RegExp(formal, 'g'), casual);
    if (newArticle !== optimized) {
      changes.push({
        position: `语气调整`,
        original: formal,
        optimized: casual,
        type: 'tone_adjust',
      });
      optimized = newArticle;
    }
  }

  return { optimizedArticle: optimized, changes };
}

/**
 * 生成衔接优化指令文本（注入 deai-optimizer 提示词）
 * 在范式创作流程中，让 deai-optimizer 切换为「素材衔接轻优化」模式
 */
export async function generateConnectionOptimizationPrompt(paradigmCode: string): Promise<string> {
  // 获取范式的情绪节奏曲线
  let emotionCurveText = '';
  try {
    const paradigm = await db
      .select({ emotionCurve: paradigmLibrary.emotionCurve, paradigmName: paradigmLibrary.paradigmName })
      .from(paradigmLibrary)
      .where(eq(paradigmLibrary.paradigmCode, paradigmCode))
      .limit(1);

    if (paradigm.length > 0 && paradigm[0].emotionCurve) {
      const curve = paradigm[0].emotionCurve as { emotion: string; intensity: number }[];
      emotionCurveText = `\n情绪节奏曲线：${curve.map((c, i) => `段落${i + 1}(${c.emotion}，强度${c.intensity})`).join(' → ')}`;
    } else {
      // 从种子数据获取
      const seed = PARADIGM_SEED_DATA.find(p => p.paradigmCode === paradigmCode);
      if (seed?.emotionCurve) {
        emotionCurveText = `\n情绪节奏曲线：${seed.emotionCurve.map((c, i) => `段落${i + 1}(${c.emotion}，强度${c.intensity})`).join(' → ')}`;
      }
    }
  } catch {
    // 数据库查询失败，降级为空
  }

  return `## 衔接词替换规则
以下AI味衔接词必须替换为口语化表达：
- 「因此」→「所以啊」「这就是为什么」「说到这」
- 「然而」→「但问题是」「可实际上」「偏偏」
- 「综上所述」→「说到底」「我总结一下」「最后想说的」
- 「值得注意的是」→「有个事儿得说说」「注意了」
- 「毋庸置疑」→「说真的」「不夸张地说」
- 「笔者」→「我」，「读者」→「你」
${emotionCurveText}

## 个人碎片素材（选1-2个插入）
在段落间自然插入括号补充/自嘲/语气词，例如：
- 「（我之前也这么想）」
- 「（说出来不怕你笑话）」
- 「（这行干久了啥都见过）」`;
}

// ============================================================
// 小红书范式适配 Agent
// ============================================================

/**
 * 按范式小红书版结构适配
 * 适配规则：
 * 1. 用范式的「小红书版结构」，把公众号段落拆分为短句
 * 2. 按范式情绪节奏，在关键位置添加emoji
 * 3. 保留所有核心素材和观点，不做任何改写
 */
export async function adaptToXiaohongshu(params: {
  officialArticle: string;         // 公众号定稿文章
  paradigmCode: string;            // 范式ID
  filledParagraphs?: ParagraphFillResult[]; // 填充的段落（用于精确映射）
}): Promise<XhsAdaptResult> {
  const { officialArticle, paradigmCode, filledParagraphs } = params;

  // 获取范式小红书版结构
  const xhsStructure = await getXhsStructure(paradigmCode);
  const paradigmName = PARADIGM_CODE_NAME_MAP[paradigmCode] || paradigmCode;

  // 将公众号文章按段落拆分
  const paragraphs = officialArticle.split('\n\n').filter(p => p.trim());

  const sections: XhsAdaptResult['sections'] = [];

  for (const step of xhsStructure) {
    // 映射公众号段落到小红书段落
    // 小红书段落通常对应多个公众号段落
    const sourceParagraphs = mapXhsStepToOfficial(step.order, paradigmCode);
    let content = '';

    for (const srcOrder of sourceParagraphs) {
      if (srcOrder <= paragraphs.length) {
        let para = paragraphs[srcOrder - 1];
        
        // 短句处理：如果步骤要求短句，将长句拆分
        if (step.shortSentence) {
          para = splitToShortSentences(para);
        }

        // 添加emoji
        const emojis = step.emojiSuggestions || [];
        if (emojis.length > 0) {
          para = addEmojisToContent(para, emojis, step.emotion);
        }

        content += (content ? '\n' : '') + para;
      }
    }

    // 如果有填充段落，直接用素材内容（更精确）
    if (filledParagraphs) {
      const relevantParagraphs = filledParagraphs.filter(p => 
        sourceParagraphs.includes(p.order)
      );
      if (relevantParagraphs.length > 0) {
        content = relevantParagraphs
          .map(p => {
            let text = p.filledContent;
            if (step.shortSentence) {
              text = splitToShortSentences(text);
            }
            const emojis = step.emojiSuggestions || [];
            if (emojis.length > 0) {
              text = addEmojisToContent(text, emojis, step.emotion);
            }
            return text;
          })
          .join('\n');
      }
    }

    sections.push({
      order: step.order,
      stepName: step.stepName,
      content: content || `【${step.stepName}】`,
      emojiSuggestions: step.emojiSuggestions || [],
    });
  }

  // 拼接完整小红书内容
  const fullContent = sections
    .map(s => s.content)
    .join('\n\n');

  return {
    paradigmCode,
    paradigmName,
    sections,
    fullContent,
  };
}

/** 获取范式小红书版结构 */
async function getXhsStructure(paradigmCode: string): Promise<any[]> {
  const paradigm = await db
    .select({ xiaohongshuStructure: paradigmLibrary.xiaohongshuStructure })
    .from(paradigmLibrary)
    .where(eq(paradigmLibrary.paradigmCode, paradigmCode))
    .limit(1);

  if (paradigm.length > 0 && paradigm[0].xiaohongshuStructure) {
    return paradigm[0].xiaohongshuStructure as any[];
  }

  const seed = PARADIGM_SEED_DATA.find(p => p.paradigmCode === paradigmCode);
  return seed ? [...seed.xiaohongshuStructure] : [];
}

/** 映射小红书步骤到公众号段落序号 */
function mapXhsStepToOfficial(xhsOrder: number, paradigmCode: string): number[] {
  const seed = PARADIGM_SEED_DATA.find(p => p.paradigmCode === paradigmCode);
  if (!seed) return [xhsOrder];

  const xhsSteps = seed.xiaohongshuStructure;
  const officialSteps = seed.officialAccountStructure;

  // 简单映射：小红书步骤数 < 公众号步骤数，多个公众号段落合并为一个小红书段落
  const ratio = officialSteps.length / xhsSteps.length;
  const startOrder = Math.round((xhsOrder - 1) * ratio) + 1;
  const endOrder = Math.round(xhsOrder * ratio);
  const result: number[] = [];
  for (let i = startOrder; i <= endOrder; i++) {
    result.push(i);
  }
  return result.length > 0 ? result : [xhsOrder];
}

/** 将长句拆分为短句 */
function splitToShortSentences(text: string): string {
  // 在句号、感叹号后插入换行（如果单句超过30字）
  return text
    .replace(/([。！？])\s*/g, '$1\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .join('\n');
}

/** 在内容中添加emoji */
function addEmojisToContent(content: string, emojis: string[], emotion?: string): string {
  if (emojis.length === 0) return content;

  // 在段首添加emoji
  const firstEmoji = emojis[0];
  
  // 在关键位置添加emoji（感叹号/问号后）
  let result = `${firstEmoji} ${content}`;
  
  // 在感叹号后随机添加emoji
  let emojiIndex = 1;
  result = result.replace(/！/g, () => {
    if (emojiIndex < emojis.length) {
      return `！${emojis[emojiIndex++]}`;
    }
    return '！';
  });

  return result;
}

// ============================================================
// 完整创作流程编排
// ============================================================

/**
 * 范式创作完整流程
 * 步骤：范式识别 → 素材匹配 → 原位填充 → 衔接优化
 */
export async function paradigmCreationPipeline(params: {
  articleType?: string;
  industry?: string;
  topic?: string;
  taskDescription?: string;
  topicTags?: string[];
  personalFragments?: string[];
  paradigmMaterialBindings?: Record<string, string>; // 🔥 用户手动绑定的素材（slotId → materialId）
}): Promise<{
  recognition: ParadigmRecognitionResult;
  filledArticle: ArticleFillResult;
  optimizedArticle: ConnectiveOptimizeResult;
}> {
  const { articleType, industry, topic, taskDescription, topicTags, personalFragments, paradigmMaterialBindings } = params;

  // Step 1: 范式识别
  const recognition = await recognizeParadigm({ articleType, industry, topic, taskDescription });

  // Step 2: 素材匹配
  const matchedMaterials = await matchMaterials({
    paradigmCode: recognition.paradigmCode,
    industry,
    topicTags,
    paradigmPositionMap: await getParadigmPositionMap(recognition.paradigmCode),
  });

  // Step 3: 原位填充
  const filledArticle = await fillParadigmArticle({
    paradigmCode: recognition.paradigmCode,
    matchedMaterials,
    paradigmStructure: await getParadigmStructure(recognition.paradigmCode),
    paradigmMaterialBindings, // 🔥 传递用户手动绑定的素材
  });

  // Step 4: 衔接优化
  const emotionCurve = await getParadigmEmotionCurve(recognition.paradigmCode);
  const optimizedArticle = optimizeConnectives({
    article: filledArticle.fullArticle,
    emotionCurve: emotionCurve as any[],
    personalFragments,
  });

  return { recognition, filledArticle, optimizedArticle };
}

// ============================================================
// 辅助函数
// ============================================================

/** 获取范式详情（含完整结构） */
export async function getParadigmDetail(paradigmCode: string) {
  const paradigm = await db
    .select()
    .from(paradigmLibrary)
    .where(eq(paradigmLibrary.paradigmCode, paradigmCode))
    .limit(1);

  if (paradigm.length > 0) {
    return paradigm[0];
  }

  // 从种子数据获取
  const seed = PARADIGM_SEED_DATA.find(p => p.paradigmCode === paradigmCode);
  return seed || null;
}

/** 获取所有活跃范式列表 */
export async function getActiveParadigms() {
  const paradigms = await db
    .select({
      paradigmCode: paradigmLibrary.paradigmCode,
      paradigmName: paradigmLibrary.paradigmName,
      description: paradigmLibrary.description,
      applicableArticleTypes: paradigmLibrary.applicableArticleTypes,
      applicableIndustries: paradigmLibrary.applicableIndustries,
      sortOrder: paradigmLibrary.sortOrder,
    })
    .from(paradigmLibrary)
    .where(eq(paradigmLibrary.isActive, true))
    .orderBy(asc(paradigmLibrary.sortOrder));

  if (paradigms.length > 0) {
    return paradigms;
  }

  // 从种子数据获取
  return PARADIGM_SEED_DATA.map(p => ({
    paradigmCode: p.paradigmCode,
    paradigmName: p.paradigmName,
    description: p.description,
    applicableArticleTypes: p.applicableArticleTypes,
    applicableIndustries: p.applicableIndustries,
    sortOrder: p.sortOrder,
  }));
}

/** 范式 → 生成写作Agent提示词（用于insurance-d集成） */
export async function generateParadigmPrompt(params: {
  paradigmCode: string;
  industry?: string;
  topicTags?: string[];
  /** 用户选择的素材（用于素材-范式融合） */
  userMaterials?: Array<{
    id: string;
    title: string;
    type: string;
    sceneType?: string;
  }>;
  /** 范式需求清单（简化版：用户素材直接映射） */
  requirementList?: { paradigmName: string; slots: Array<{ paragraphOrder: number; stepName: string; materialTypes: string[]; filledBy?: { title: string; type: string } }> };
}): Promise<string> {
  const { paradigmCode, industry, topicTags, userMaterials, requirementList } = params;

  const structure = await getParadigmStructure(paradigmCode);
  const positionMap = await getParadigmPositionMap(paradigmCode);
  const emotionCurve = await getParadigmEmotionCurve(paradigmCode);
  const paradigmName = PARADIGM_CODE_NAME_MAP[paradigmCode] || paradigmCode;

  // 构建素材位置映射说明
  const positionGuide = positionMap.map((slot: any) => {
    const step = structure.find((s: any) => s.order === slot.paragraphOrder);
    return `段落${slot.paragraphOrder}【${step?.stepName || slot.stepName}】：需要${slot.materialTypes.join('/')}类型素材${slot.isPrimary ? '（主素材槽位，必须填充）' : '（辅助素材槽位）'}`;
  }).join('\n');

  // 构建情绪曲线说明
  const emotionGuide = emotionCurve.map((e: any) => 
    `段落${e.paragraphOrder}【${e.stepName}】：情绪=${e.emotion}，强度=${e.intensity}/10`
  ).join('\n');

  // 构建固定句式说明
  const phraseGuide = structure.map((step: any) => {
    if (step.fixedPhrases?.length > 0) {
      return `段落${step.order}【${step.stepName}】推荐句式：${step.fixedPhrases.join(' / ')}`;
    }
    return '';
  }).filter(Boolean).join('\n');

  // 🔥 素材-范式融合：如果有用户素材，构建融合指令（简化版：直接匹配type）
  let fusionGuide = '';
  if (requirementList) {
    // 外部已构建需求清单，直接格式化
    fusionGuide = '\n\n## 素材填充要求\n\n' + requirementList.slots.map(slot => {
      const filled = slot.filledBy ? `✅ 已填充：${slot.filledBy.title}（${slot.filledBy.type}）` : '❌ 未填充';
      return `段落${slot.paragraphOrder}【${slot.stepName}】：需要 ${slot.materialTypes.join('/')} → ${filled}`;
    }).join('\n');
    fusionGuide += `\n\n范式：${requirementList.paradigmName}`;
  } else if (userMaterials && userMaterials.length > 0) {
    // 简化版：直接按type匹配段落槽位
    const slots = positionMap.map((slot: any) => {
      const matched = userMaterials.find(m => slot.materialTypes.includes(m.type));
      return {
        paragraphOrder: slot.paragraphOrder,
        stepName: slot.stepName,
        materialTypes: slot.materialTypes,
        filledBy: matched ? { title: matched.title, type: matched.type } : undefined,
      };
    });
    fusionGuide = '\n\n## 素材填充要求\n\n' + slots.map(slot => {
      const filled = slot.filledBy ? `✅ 已填充：${slot.filledBy.title}（${slot.filledBy.type}）` : '❌ 未填充';
      return `段落${slot.paragraphOrder}【${slot.stepName}】：需要 ${slot.materialTypes.join('/')} → ${filled}`;
    }).join('\n');
    fusionGuide += `\n\n范式：${paradigmName}`;
  }

  return `# 创作范式：${paradigmName}（${paradigmCode}）

## 范式结构（严格按此顺序创作，不可调换段落顺序）

${structure.map((step: any) => `### 段落${step.order}：${step.stepName}
- 标题模板：${step.titleTemplate}
- 内容要求：${step.contentRequirement}
- 字数范围：${step.wordRange.min}~${step.wordRange.max}字
${step.required ? '- 【必须段落，不可省略】' : '- 【可选段落】'}`).join('\n\n')}

## 素材位置映射（每段需要什么类型的素材）

${positionGuide}

## 情绪节奏曲线

${emotionGuide}

## 推荐固定句式

${phraseGuide || '无固定句式要求'}
${fusionGuide}
## 创作纪律（必须严格遵守 - 位置ID三重绑定）

1. **只填素材，不写内容**：AI不新增任何原创句子，仅从素材库中调取内容填充
2. **🔥 【绝对禁止规则】位置ID三重绑定**：只能将带有「slotId」等于当前占位符slotId的素材，填充到该占位符中。任何情况下，都不允许将素材填充到slotId不匹配的占位符中。这是最高优先级规则，违反即视为创作失败
3. **🔥 严格按位置填充**：素材必须和范式的「段落位置」完全匹配，不打乱顺序。优先使用slotId精确匹配的素材（score=1.0），其次使用paradigmPosition匹配的素材（score=0.9）
4. **🔥 每个插入点只能插入对应类型素材**：比如P001-02只能插错误认知素材，不能插金句或案例
5. **素材必须成对使用**：优先调用带「前后文关系」的素材，不使用孤立单句
6. **防重复调用**：同一素材7天内不重复使用，优先调用使用次数少的素材
7. **不改动范式结构**：不增减段落、不调换顺序、不修改换行和空行。固定上下文一个字都不能改，包括换行、空行和标点
8. **衔接词自然化**：避免「因此」「然而」「综上所述」等AI味衔接词
9. **用户素材优先**：用户指定的素材必须使用且放在对应段落，同一段落不重复填充
${industry ? `10. **行业限定**：当前创作行业为「${industry}」，素材选择需对齐行业` : ''}
`;
}
