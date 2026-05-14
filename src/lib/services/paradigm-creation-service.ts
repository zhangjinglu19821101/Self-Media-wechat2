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
      if (p.applicableArticleTypes.includes(articleType)) {
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
    let bestP = PARADIGM_SEED_DATA[0];
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
 * 核心规则：
 * 1. 优先匹配带范式关联的素材（paradigmId + paradigmPosition）
 * 2. 其次按场景类型+行业+标签匹配
 * 3. 防重复：7天内不重复使用同一素材
 * 4. 优先使用次数少的素材
 */
export async function matchMaterials(params: {
  paradigmCode: string;           // 范式ID
  industry?: string;              // 行业
  topicTags?: string[];           // 主题标签
  excludeIds?: string[];          // 排除的素材ID（防重复）
  paradigmPositionMap?: any[];    // 范式的素材位置映射
}): Promise<Map<number, MaterialMatchResult[]>> {
  const { paradigmCode, industry, topicTags, excludeIds = [], paradigmPositionMap } = params;
  
  const result = new Map<number, MaterialMatchResult[]>();
  
  // 获取范式位置映射
  const positionMap = paradigmPositionMap || await getParadigmPositionMap(paradigmCode);
  if (!positionMap || positionMap.length === 0) {
    console.warn(`[matchMaterials] 范式 ${paradigmCode} 无素材位置映射`);
    return result;
  }

  // 7天前的时间戳
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  for (const slot of positionMap) {
    const materials: MaterialMatchResult[] = [];
    const materialTypes = slot.materialTypes as string[];
    const paragraphOrder = slot.paragraphOrder as number;

    // 策略1：精确匹配 paradigmId + paradigmPosition
    const exactMatches = await db
      .select()
      .from(materialLibrary)
      .where(
        and(
          eq(materialLibrary.status, 'active'),
          eq(materialLibrary.paradigmId, paradigmCode),
          eq(materialLibrary.paradigmPosition, `${paradigmCode}-段落${paragraphOrder}`),
          or(
            sql`${materialLibrary.lastUsedAt} IS NULL`,
            sql`${materialLibrary.lastUsedAt} <= ${sevenDaysAgo}`
          ),
          ...buildExcludeCondition(excludeIds)
        )
      )
      .orderBy(asc(materialLibrary.useCount))
      .limit(3);

    for (const m of exactMatches) {
      materials.push({
        materialId: m.id,
        title: m.title,
        content: m.content || '',
        materialType: m.sceneType || m.type,
        paradigmPosition: m.paradigmPosition || '',
        score: 1.0,
        hasPreContext: !!(m.sceneTags as string[])?.some(t => t === '承接' || t === '过渡'),
        hasPostContext: !!(m.sceneTags as string[])?.some(t => t === '引出' || t === '铺垫'),
      });
    }

    // 策略2：如果精确匹配不足，按 sceneType + industry 匹配
    if (materials.length < 2) {
      const sceneTypes = materialTypes.map(t => SCENE_TYPE_TO_MATERIAL_TYPE[t] || t);
      const existingIds = materials.map(m => m.materialId);
      const allExcludeIds = [...excludeIds, ...existingIds];

      const sceneMatches = await db
        .select()
        .from(materialLibrary)
        .where(
          and(
            eq(materialLibrary.status, 'active'),
            or(...sceneTypes.map(st => eq(materialLibrary.sceneType, st))),
            industry ? eq(materialLibrary.industry, industry) : undefined,
            or(
              sql`${materialLibrary.lastUsedAt} IS NULL`,
              sql`${materialLibrary.lastUsedAt} <= ${sevenDaysAgo}`
            ),
            ...buildExcludeCondition(allExcludeIds)
          )
        )
        .orderBy(asc(materialLibrary.useCount))
        .limit(3 - materials.length);

      for (const m of sceneMatches) {
        materials.push({
          materialId: m.id,
          title: m.title,
          content: m.content || '',
          materialType: m.sceneType || m.type,
          paradigmPosition: m.paradigmPosition || '',
          score: 0.7,
          hasPreContext: !!(m.sceneTags as string[])?.some(t => t === '承接' || t === '过渡'),
          hasPostContext: !!(m.sceneTags as string[])?.some(t => t === '引出' || t === '铺垫'),
        });
      }
    }

    // 策略3：如果仍然不足，按 topicTags 匹配
    if (materials.length < 1 && topicTags && topicTags.length > 0) {
      const existingIds = materials.map(m => m.materialId);
      const allExcludeIds = [...excludeIds, ...existingIds];
      
      const tagMatches = await db
        .select()
        .from(materialLibrary)
        .where(
          and(
            eq(materialLibrary.status, 'active'),
            sql`${materialLibrary.topicTags} ?| ${topicTags}`,
            or(
              sql`${materialLibrary.lastUsedAt} IS NULL`,
              sql`${materialLibrary.lastUsedAt} <= ${sevenDaysAgo}`
            ),
            ...buildExcludeCondition(allExcludeIds)
          )
        )
        .orderBy(asc(materialLibrary.useCount))
        .limit(1);

      for (const m of tagMatches) {
        materials.push({
          materialId: m.id,
          title: m.title,
          content: m.content || '',
          materialType: m.sceneType || m.type,
          paradigmPosition: m.paradigmPosition || '',
          score: 0.4,
          hasPreContext: !!(m.sceneTags as string[])?.some(t => t === '承接' || t === '过渡'),
          hasPostContext: !!(m.sceneTags as string[])?.some(t => t === '引出' || t === '铺垫'),
        });
      }
    }

    result.set(paragraphOrder, materials);
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
 * 核心规则：
 * 1. 只填素材，不写内容
 * 2. 严格按位置填充
 * 3. 素材必须成对使用（优先有前后文关系的）
 * 4. 防重复调用
 */
export async function fillParadigmArticle(params: {
  paradigmCode: string;
  matchedMaterials: Map<number, MaterialMatchResult[]>;
  paradigmStructure?: any[];      // 范式公众号版结构
}): Promise<ArticleFillResult> {
  const { paradigmCode, matchedMaterials } = params;

  // 获取范式结构
  const structure = params.paradigmStructure || await getParadigmStructure(paradigmCode);
  const positionMap = await getParadigmPositionMap(paradigmCode);
  const emotionCurve = await getParadigmEmotionCurve(paradigmCode);
  const paradigmName = PARADIGM_CODE_NAME_MAP[paradigmCode] || paradigmCode;

  const paragraphs: ParagraphFillResult[] = [];
  const allUsedMaterialIds: string[] = [];

  for (const step of structure) {
    const order = step.order as number;
    const materials = matchedMaterials.get(order) || [];
    
    // 优先选择有前后文关系的素材
    let selectedMaterial: MaterialMatchResult | null = null;
    const withContext = materials.filter(m => m.hasPreContext || m.hasPostContext);
    const withoutContext = materials.filter(m => !m.hasPreContext && !m.hasPostContext);

    if (withContext.length > 0) {
      selectedMaterial = withContext[0];
    } else if (withoutContext.length > 0) {
      selectedMaterial = withoutContext[0];
    }

    // 构建段落内容
    let filledContent = '';
    const usedIds: string[] = [];

    if (selectedMaterial) {
      // 核心规则：只填素材，不写内容
      filledContent = selectedMaterial.content;
      usedIds.push(selectedMaterial.materialId);
      allUsedMaterialIds.push(selectedMaterial.materialId);

      // 如果是主槽位且有固定句式，可以拼接固定句式前缀
      const slotInfo = positionMap.find((s: any) => s.paragraphOrder === order);
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
      // 无可用素材时，使用固定句式作为占位
      if (step.fixedPhrases?.length > 0) {
        filledContent = `${step.fixedPhrases[0]}……（待补充素材）`;
      } else {
        filledContent = `【${step.stepName}】待补充素材`;
      }
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
}): Promise<{
  recognition: ParadigmRecognitionResult;
  filledArticle: ArticleFillResult;
  optimizedArticle: ConnectiveOptimizeResult;
}> {
  const { articleType, industry, topic, taskDescription, topicTags, personalFragments } = params;

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
}): Promise<string> {
  const { paradigmCode, industry, topicTags } = params;

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

## 创作纪律（必须严格遵守）

1. **只填素材，不写内容**：AI不新增任何原创句子，仅从素材库中调取内容填充
2. **严格按位置填充**：素材必须和范式的「段落位置」完全匹配，不打乱顺序
3. **素材必须成对使用**：优先调用带「前后文关系」的素材，不使用孤立单句
4. **防重复调用**：同一素材7天内不重复使用，优先调用使用次数少的素材
5. **不改动范式结构**：不增减段落、不调换顺序、不修改换行和空行
6. **衔接词自然化**：避免「因此」「然而」「综上所述」等AI味衔接词
${industry ? `7. **行业限定**：当前创作行业为「${industry}」，素材选择需对齐行业` : ''}
`;
}
