/**
 * 文章拆解服务 v2 — 范式识别 + 关系型素材提取
 * 
 * 核心升级：
 * - 从5层21维全量拆解 → 两步拆解法
 * - Step 1: 范式自动识别（匹配10套标准范式）
 * - Step 2: 关系型素材自动提取（7维，保留上下文/位置/情绪/关系）
 * 
 * 解决的3个致命缺陷：
 * 1. 过度原子化 → 关系型素材保留上下文和情绪流动
 * 2. 维度冗余 → 从21维精简到7维，只保留写作真正需要的
 * 3. 只提取"写了什么" → 增加"怎么写的"（范式结构+情绪曲线+衔接关系）
 */

import { callLLM } from '@/lib/agent-llm';

// ============================================================
// 10套标准范式定义
// ============================================================

export const STANDARD_PARADIGMS = [
  {
    id: 'standard_misalignment',
    name: '标准错位破局范式',
    description: '先抛出错误认知→共情接纳→点破标准错位→通俗类比→真实案例→反问→价值重构→金句收尾',
    structure: ['错误认知', '共情接纳', '点破标准错位', '通俗类比', '真实案例', '反问', '价值重构', '金句收尾'],
    signaturePhrases: ['说实话，这种想法我特别理解', '但问题出在哪呢', '其实不是', '你想想'],
    emotionCurve: ['警醒', '共情', '突破', '释然', '坚定', '升华'],
    applicableTypes: ['客户误区型'],
  },
  {
    id: 'industry_reflection',
    name: '行业反思范式',
    description: '引出行业问题→承认行业不足→区分工具与人→分析问题根源→提出改进方向→收尾升华',
    structure: ['行业问题', '承认不足', '区分工具与人', '分析根源', '改进方向', '收尾升华'],
    signaturePhrases: ['这个行业确实', '不是工具的问题', '说到底', '我们从业者'],
    emotionCurve: ['质疑', '坦诚', '理性', '建设性', '希望'],
    applicableTypes: ['行业新认知型'],
  },
  {
    id: 'case_reductio',
    name: '案例归谬范式',
    description: '抛出错误观点→讲述反面案例→用案例归谬错误观点→给出正确结论→收尾',
    structure: ['错误观点', '反面案例', '案例归谬', '正确结论', '收尾'],
    signaturePhrases: ['你看这个案例', '结果呢', '这不就说明', '所以真正'],
    emotionCurve: ['警醒', '惋惜', '顿悟', '坚定'],
    applicableTypes: ['客户误区型', '事件驱动型'],
  },
  {
    id: 'essence_definition',
    name: '本质定义范式',
    description: '抛出常见错误定义→拆解错误定义的问题→给出正确的本质定义→用类比解释→案例佐证→收尾',
    structure: ['错误定义', '拆解问题', '正确本质', '类比解释', '案例佐证', '收尾'],
    signaturePhrases: ['很多人以为', '但实际上', '真正的定义是', '打个比方'],
    emotionCurve: ['困惑', '恍然', '清晰', '确信'],
    applicableTypes: ['客户误区型', '行业新认知型'],
  },
  {
    id: 'hot_event',
    name: '热点事件范式',
    description: '引出热点事件→分析事件中的保险相关问题→给出正确的应对方式→延伸到普遍情况→收尾',
    structure: ['热点事件', '保险分析', '正确应对', '普遍延伸', '收尾'],
    signaturePhrases: ['最近有个新闻', '这件事告诉我们', '如果是你', '不只是这个案例'],
    emotionCurve: ['关注', '分析', '警醒', '行动'],
    applicableTypes: ['事件驱动型'],
  },
  {
    id: 'product_review',
    name: '产品解读范式',
    description: '介绍产品基本信息→分析产品优势→分析产品不足→适合人群→不适合人群→购买建议',
    structure: ['产品信息', '产品优势', '产品不足', '适合人群', '不适合人群', '购买建议'],
    signaturePhrases: ['先说结论', '优点是', '但要注意', '适合', '不建议'],
    emotionCurve: ['客观', '肯定', '谨慎', '务实', '建议'],
    applicableTypes: ['行业新认知型'],
  },
  {
    id: 'personal_experience',
    name: '个人经历范式',
    description: '讲述自己的亲身经历→从经历中得到的感悟→延伸到保险的价值→收尾升华',
    structure: ['亲身经历', '感悟', '保险价值', '收尾升华'],
    signaturePhrases: ['我自己', '那次之后', '我才真正明白', '所以我说'],
    emotionCurve: ['叙事', '感悟', '升华', '坚定'],
    applicableTypes: ['客户误区型', '事件驱动型'],
  },
  {
    id: 'pitfall_guide',
    name: '避坑指南范式',
    description: '引出某类保险的常见问题→逐条讲解每个坑的表现和危害→给出避坑方法→收尾',
    structure: ['常见问题', '坑的表现', '坑的危害', '避坑方法', '收尾'],
    signaturePhrases: ['很多人踩过', '第一个坑', '第二个坑', '怎么避免', '记住这三点'],
    emotionCurve: ['警醒', '细节', '警醒', '安心'],
    applicableTypes: ['客户误区型'],
  },
  {
    id: 'comparative_analysis',
    name: '对比分析范式',
    description: '介绍两种不同的选择→分别分析各自的优缺点→给出不同情况下的选择建议→收尾',
    structure: ['两种选择', 'A优缺点', 'B优缺点', '选择建议', '收尾'],
    signaturePhrases: ['两种方案', '先看', '再看', '怎么选', '关键看'],
    emotionCurve: ['客观', '分析', '权衡', '建议'],
    applicableTypes: ['行业新认知型'],
  },
  {
    id: 'year_end_review',
    name: '年终总结范式',
    description: '回顾过去一年的行业变化→总结自己的感悟→对未来的展望→给读者的建议→收尾',
    structure: ['行业变化', '个人感悟', '未来展望', '读者建议', '收尾'],
    signaturePhrases: ['回顾这一年', '最大的变化', '我个人的感受', '给大家的建议'],
    emotionCurve: ['回顾', '感慨', '期待', '建议'],
    applicableTypes: ['行业新认知型'],
  },
] as const;

export type ParadigmId = typeof STANDARD_PARADIGMS[number]['id'];

// ============================================================
// 范式识别结果
// ============================================================

export interface ParadigmRecognitionResult {
  /** 匹配的范式ID */
  matchedParadigmId: ParadigmId | string;
  /** 匹配的范式名称 */
  matchedParadigmName: string;
  /** 匹配度 0-100 */
  matchScore: number;
  /** 结构差异说明（匹配度<90时说明差异） */
  structureDifference: string;
  /** 5维匹配详情 */
  matchDetails: {
    structureOrder: number;      // 文章结构顺序 0-100
    transitionPhrases: number;   // 固定衔接句式 0-100
    emotionCurve: number;        // 情绪节奏曲线 0-100
    paragraphRules: number;      // 段落换行规则 0-100
    articleType: number;         // 文章类型 0-100
  };
  /** 识别出的结构步骤映射（原文段落 → 范式步骤） */
  structureMapping: Array<{
    paradigmStep: string;
    originalParagraph: string;
    paragraphIndex: number;
  }>;
}

// ============================================================
// 关系型素材（7维）
// ============================================================

export interface RelationalMaterial {
  /** 素材唯一ID */
  id: string;
  /** 素材类型（7种） */
  materialType: 'misconception' | 'analogy' | 'case' | 'data' | 'golden_sentence' | 'fixed_phrase' | 'personal_fragment';
  /** 素材内容（保留原文，不做改写） */
  content: string;
  /** 在原文中的位置（段落索引） */
  position: number;
  /** 上下文：前一句原文 */
  contextBefore: string;
  /** 上下文：后一句原文 */
  contextAfter: string;
  /** 该点的情绪标签 */
  emotion: string;
  /** 与前一个素材的关系 */
  relationToPrevious: string;
  /** 该素材属于范式的哪个步骤 */
  paradigmStep: string;
  /** 主题标签 */
  topicTags: string[];
  /** 场景标签 */
  sceneTags: string[];
}

export const MATERIAL_TYPE_LABELS: Record<RelationalMaterial['materialType'], string> = {
  misconception: '错误认知',
  analogy: '生活类比',
  case: '真实案例',
  data: '权威数据',
  golden_sentence: '金句',
  fixed_phrase: '固定句式组合',
  personal_fragment: '个人碎片',
};

export const MATERIAL_TYPE_DESCRIPTIONS: Record<RelationalMaterial['materialType'], string> = {
  misconception: '大众的错误观点原话，以及后面紧跟的第一句共情接纳的话',
  analogy: '生活化的比喻，以及前面一句引出比喻的话',
  case: '完整的案例，以及前面一句引出案例的话',
  data: '行业数据、官方统计，以及后面一句基于数据得出的结论',
  golden_sentence: '结尾的总结性金句，以及前面一句引出金句的话',
  fixed_phrase: '不可分割的2-3个连续标志性句子，保留换行和空行',
  personal_fragment: '作者的小吐槽、小自嘲、小停顿等个人化表达',
};

// ============================================================
// 完整提取结果
// ============================================================

export interface ArticleExtractionResultV2 {
  /** 文章标题 */
  articleTitle: string;
  /** 文章类型 */
  articleType: string;
  /** 核心主题 */
  coreTheme: string;
  /** 目标人群 */
  targetAudience: string;
  /** 情感基调 */
  emotionalTone: string;
  /** 发布平台 */
  platform: string;

  /** Step 1: 范式识别结果 */
  paradigmRecognition: ParadigmRecognitionResult;

  /** Step 2: 关系型素材（7维） */
  relationalMaterials: RelationalMaterial[];

  /** 情绪曲线（全文段落的情绪标注序列） */
  emotionCurve: Array<{
    paragraphIndex: number;
    paragraphPreview: string;
    emotion: string;
    intensity: number; // 1-10
  }>;

  /** 段落节奏（每段字数、换行模式） */
  paragraphRhythm: Array<{
    paragraphIndex: number;
    charCount: number;
    hasBlankLineAfter: boolean;
    isShortSentence: boolean; // ≤30字
  }>;

  /** 资产价值评分 */
  assetValueScore: number;
  /** 可复用维度计数 */
  reusableDimensionCount: number;
}

// ============================================================
// 范式识别提示词
// ============================================================

function buildParadigmRecognitionPrompt(articleContent: string): string {
  const paradigmList = STANDARD_PARADIGMS.map((p, i) => 
    `${i + 1}. ${p.name}：${p.description}\n   标志句式：${p.signaturePhrases.join('、')}\n   适用类型：${p.applicableTypes.join('、')}`
  ).join('\n\n');

  return `# 文章范式识别器

## 任务
将输入的文章与下面10套标准范式进行匹配，输出匹配度最高的范式名称和匹配度。

## 10套标准范式

${paradigmList}

## 匹配规则（5个维度按权重打分）
1. 文章结构顺序（权重40%）：对比段落的先后顺序是否与范式一致
2. 固定衔接句式（权重30%）：对比是否包含该范式的标志句式
3. 情绪节奏曲线（权重15%）：对比文章的情绪起伏是否符合该范式的标准曲线
4. 段落换行规则（权重10%）：对比换行和空行习惯是否与范式一致
5. 文章类型（权重5%）：辅助匹配

## 输出格式
严格按照下面的JSON格式输出，不添加任何额外内容：
{
  "matchedParadigmId": "范式ID（如standard_misalignment）",
  "matchedParadigmName": "范式名称",
  "matchScore": 85,
  "structureDifference": "如果匹配度低于90分，说明文章结构与标准范式的差异；如果匹配度≥90分，填写\"完全符合\"",
  "matchDetails": {
    "structureOrder": 90,
    "transitionPhrases": 80,
    "emotionCurve": 85,
    "paragraphRules": 75,
    "articleType": 95
  },
  "structureMapping": [
    {"paradigmStep": "错误认知", "originalParagraph": "原文中对应段落的前50字", "paragraphIndex": 0},
    {"paradigmStep": "共情接纳", "originalParagraph": "原文中对应段落的前50字", "paragraphIndex": 1}
  ]
}

## 待识别文章全文
${articleContent}`;
}

// ============================================================
// 关系型素材提取提示词
// ============================================================

function buildRelationalExtractionPrompt(
  articleContent: string, 
  paradigmRecognition: ParadigmRecognitionResult
): string {
  const paradigm = STANDARD_PARADIGMS.find(p => p.id === paradigmRecognition.matchedParadigmId);
  const paradigmInfo = paradigm 
    ? `范式名称：${paradigm.name}\n范式结构：${paradigm.structure.join(' → ')}\n标志句式：${paradigm.signaturePhrases.join('、')}`
    : `范式名称：${paradigmRecognition.matchedParadigmName}\n匹配度：${paradigmRecognition.matchScore}分`;

  const structureMappingStr = paradigmRecognition.structureMapping
    .map(m => `步骤"${m.paradigmStep}" → 第${m.paragraphIndex}段: ${m.originalParagraph}`)
    .join('\n');

  return `# 关系型素材提取器

## 核心原则
1. **保留原文**：提取的内容必须是原文原话，不做任何改写、总结或润色
2. **保留关系**：每个素材必须标注位置、上下文、情绪、与前文的关系
3. **保留节奏**：标注情绪曲线和段落节奏，这些决定文章的"呼吸感"
4. **只提有用的**：只提取7种类型的素材，不提取无用维度

## 已识别的范式
${paradigmInfo}

## 结构映射
${structureMappingStr || '未识别到明确的结构映射'}

## 7种素材类型定义（与设计方案严格对齐）

| 类型 | 说明 | 提取规则 |
|------|------|----------|
| misconception（错误认知） | 大众的错误观点原话，以及后面紧跟的第一句共情接纳的话 | 必须包含2个以上连续句子，一字不差保留原文，保留换行和空行 |
| analogy（生活类比） | 生活化的比喻，以及前面一句引出比喻的话 | 必须包含2个以上连续句子，保留类比逻辑和前后节奏 |
| case（真实案例） | 完整的案例，以及前面一句引出案例的话 | 保留完整因果链：起因→经过→结果，保留换行和空行 |
| data（权威数据） | 行业数据、官方统计，以及后面一句基于数据得出的结论 | 必须标注数据来源和年份，保留数据和结论的搭配 |
| golden_sentence（金句） | 结尾的总结性金句，以及前面一句引出金句的话 | 必须包含2个以上连续句子，保留换行和节奏 |
| fixed_phrase（固定句式组合） | 不可分割的2-3个连续标志性句子 | 完整保留，不能拆开使用，保留换行和空行 |
| personal_fragment（个人碎片） | 作者的小吐槽、小自嘲、小停顿等个人化表达 | 保留完整个人化表达，包括语气词和停顿 |

## 输出格式
严格按照下面的JSON格式输出，不添加任何额外内容：
{
  "articleTitle": "文章标题",
  "articleType": "客户误区型/事件驱动型/行业新认知型",
  "coreTheme": "核心主题（如增额寿回本逻辑）",
  "targetAudience": "目标人群",
  "emotionalTone": "共情式破局/理性客观/踩坑警醒/专业权威",
  "platform": "公众号/小红书/抖音/朋友圈",
  "relationalMaterials": [
    {
      "id": "m1",
      "materialType": "misconception",
      "content": "原文原话（一字不差）",
      "position": 0,
      "contextBefore": "前一句原文",
      "contextAfter": "后一句原文",
      "emotion": "警醒",
      "relationToPrevious": "首句，无前文",
      "paradigmStep": "错误认知",
      "topicTags": ["港险", "增额寿"],
      "sceneTags": ["误区反驳"]
    }
  ],
  "emotionCurve": [
    {"paragraphIndex": 0, "paragraphPreview": "段落前20字", "emotion": "警醒", "intensity": 7}
  ],
  "paragraphRhythm": [
    {"paragraphIndex": 0, "charCount": 45, "hasBlankLineAfter": true, "isShortSentence": false}
  ]
}

## 提取注意事项
1. 绝对不提取单个的孤立句子，所有素材的最小单位是2个连续的句子
2. misconception必须包含"错误观点+共情接纳句"的组合
3. analogy必须保留类比逻辑和引出比喻的前一句
4. case必须保留完整因果链和引出案例的前一句
5. data必须标注来源和年份，且包含基于数据得出的结论
6. golden_sentence保留金句+引出金句的前一句
7. fixed_phrase必须完整保留2-3个标志性句子，不能拆开
8. personal_fragment保留作者的小吐槽、小自嘲等个人化表达
9. 严格保留原文的所有换行、空行、标点和语气词
10. 所有提取的内容必须一字不差来自原文，不能有任何改写

## 待提取文章全文
${articleContent}`;
}

// ============================================================
// 服务方法
// ============================================================

/**
 * Step 1: 范式识别
 * 调用LLM将文章与10套标准范式匹配
 */
export async function recognizeParadigm(
  articleContent: string,
  workspaceId?: string
): Promise<ParadigmRecognitionResult> {
  const prompt = buildParadigmRecognitionPrompt(articleContent);

  const llmResult = await callLLM(
    'article-extractor',
    '文章范式识别',
    '你是专业的保险文章范式识别专家，严格按照JSON格式输出。',
    prompt,
    {
      timeout: 60000,
      temperature: 0, // 范式识别温度为0，确保确定性
      workspaceId,
    }
  );

  // 解析LLM返回的JSON
  const parsed = parseLLMJsonResponse(llmResult);

  // 验证并补全匹配详情
  const matchScore = typeof parsed.matchScore === 'number' ? parsed.matchScore : 70;
  const matchDetails = parsed.matchDetails || {
    structureOrder: Math.round(matchScore * 0.4),
    transitionPhrases: Math.round(matchScore * 0.3),
    emotionCurve: Math.round(matchScore * 0.15),
    paragraphRules: Math.round(matchScore * 0.1),
    articleType: Math.round(matchScore * 0.05),
  };

  return {
    matchedParadigmId: String(parsed.matchedParadigmId || 'standard_misalignment'),
    matchedParadigmName: String(parsed.matchedParadigmName || '标准错位破局范式'),
    matchScore,
    structureDifference: String(parsed.structureDifference || '未识别到结构差异'),
    matchDetails: matchDetails as ParadigmRecognitionResult['matchDetails'],
    structureMapping: Array.isArray(parsed.structureMapping) ? parsed.structureMapping as ParadigmRecognitionResult['structureMapping'] : [],
  };
}

/**
 * Step 2: 关系型素材提取
 * 基于已识别的范式，提取7维关系型素材
 */
export async function extractRelationalMaterials(
  articleContent: string,
  paradigmRecognition: ParadigmRecognitionResult,
  workspaceId?: string
): Promise<Omit<ArticleExtractionResultV2, 'paradigmRecognition' | 'assetValueScore' | 'reusableDimensionCount'>> {
  const prompt = buildRelationalExtractionPrompt(articleContent, paradigmRecognition);

  const llmResult = await callLLM(
    'article-extractor',
    '关系型素材提取',
    '你是专业的保险文章素材提取专家，严格按照JSON格式输出。',
    prompt,
    {
      timeout: 90000, // 素材提取需要更长时间
      temperature: 0.1, // 低温度保证提取准确性
      workspaceId,
    }
  );

  const parsed = parseLLMJsonResponse(llmResult);

  return {
    articleTitle: String(parsed.articleTitle || ''),
    articleType: String(parsed.articleType || ''),
    coreTheme: String(parsed.coreTheme || ''),
    targetAudience: String(parsed.targetAudience || ''),
    emotionalTone: String(parsed.emotionalTone || ''),
    platform: String(parsed.platform || '公众号'),
    relationalMaterials: Array.isArray(parsed.relationalMaterials) ? parsed.relationalMaterials.map((m: Record<string, unknown>, i: number) => ({
      id: String(m.id || `m${i + 1}`),
      materialType: validateMaterialType(String(m.materialType || '')),
      content: String(m.content || ''),
      position: typeof m.position === 'number' ? m.position : i,
      contextBefore: String(m.contextBefore || ''),
      contextAfter: String(m.contextAfter || ''),
      emotion: String(m.emotion || ''),
      relationToPrevious: String(m.relationToPrevious || ''),
      paradigmStep: String(m.paradigmStep || ''),
      topicTags: Array.isArray(m.topicTags) ? m.topicTags.map(String) : [],
      sceneTags: Array.isArray(m.sceneTags) ? m.sceneTags.map(String) : [],
    })) : [],
    emotionCurve: Array.isArray(parsed.emotionCurve) ? parsed.emotionCurve as ArticleExtractionResultV2['emotionCurve'] : [],
    paragraphRhythm: Array.isArray(parsed.paragraphRhythm) ? parsed.paragraphRhythm as ArticleExtractionResultV2['paragraphRhythm'] : [],
  };
}

/**
 * 完整的两步提取流程
 */
export async function extractArticleV2(
  articleContent: string,
  workspaceId?: string
): Promise<ArticleExtractionResultV2> {
  // Step 1: 范式识别
  const paradigmRecognition = await recognizeParadigm(articleContent, workspaceId);

  // Step 2: 关系型素材提取
  const extractionResult = await extractRelationalMaterials(
    articleContent,
    paradigmRecognition,
    workspaceId
  );

  // 计算资产价值
  const { assetValueScore, reusableDimensionCount } = calculateAssetValue(extractionResult.relationalMaterials);

  return {
    ...extractionResult,
    paradigmRecognition,
    assetValueScore,
    reusableDimensionCount,
  };
}

// ============================================================
// 工具方法
// ============================================================

const VALID_MATERIAL_TYPES = ['misconception', 'analogy', 'case', 'data', 'golden_sentence', 'fixed_phrase', 'personal_fragment'];

function validateMaterialType(type: string): RelationalMaterial['materialType'] {
  if (VALID_MATERIAL_TYPES.includes(type)) {
    return type as RelationalMaterial['materialType'];
  }
  // 智能映射中文名到英文类型（与设计方案严格对齐）
  const mapping: Record<string, RelationalMaterial['materialType']> = {
    '错误认知': 'misconception',
    '生活类比': 'analogy',
    '真实案例': 'case',
    '权威数据': 'data',
    '金句': 'golden_sentence',
    '固定句式组合': 'fixed_phrase',
    '个人碎片': 'personal_fragment',
    // 兼容旧类型映射
    'emotion_point': 'personal_fragment',
    'transition': 'fixed_phrase',
    '情绪锚点': 'personal_fragment',
    '衔接关系': 'fixed_phrase',
    'hook': 'fixed_phrase',
    'closing': 'golden_sentence',
    '钩子引入': 'fixed_phrase',
    '收尾升华': 'golden_sentence',
  };
  return mapping[type] || 'case';
}

function calculateAssetValue(materials: RelationalMaterial[]): { assetValueScore: number; reusableDimensionCount: number } {
  // 按7种类型统计
  const typeCounts: Record<string, number> = {};
  for (const m of materials) {
    typeCounts[m.materialType] = (typeCounts[m.materialType] || 0) + 1;
  }

  // 有内容的维度数量
  const dimensionCount = Object.keys(typeCounts).length;

  // 核心维度（5种可积累维度）的覆盖度
  const coreDimensions = ['misconception', 'analogy', 'case', 'data', 'golden_sentence'];
  const coreCovered = coreDimensions.filter(d => typeCounts[d] && typeCounts[d] > 0).length;
  const coreCoverage = coreCovered / coreDimensions.length;

  // 素材总量评分
  const totalMaterials = materials.length;
  const quantityScore = Math.min(totalMaterials / 10, 1) * 40; // 最多40分

  // 核心维度覆盖评分
  const coverageScore = coreCoverage * 40; // 最多40分

  // 关系完整性评分（有contextBefore+contextAfter的素材比例）
  const materialsWithContext = materials.filter(m => m.contextBefore || m.contextAfter).length;
  const contextScore = totalMaterials > 0 ? (materialsWithContext / totalMaterials) * 20 : 0; // 最多20分

  const assetValueScore = Math.round(quantityScore + coverageScore + contextScore);

  return {
    assetValueScore: Math.min(assetValueScore, 100),
    reusableDimensionCount: dimensionCount,
  };
}

/**
 * 解析LLM返回的JSON（容错处理）
 */
function parseLLMJsonResponse(llmResult: string): Record<string, unknown> {
  if (!llmResult || typeof llmResult !== 'string') {
    return {};
  }

  let text = llmResult.trim();

  // 移除 markdown 代码块包裹
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  }

  // 尝试直接解析
  try {
    return JSON.parse(text);
  } catch {
    // 尝试提取 JSON 对象
    const braceStart = text.indexOf('{');
    const braceEnd = text.lastIndexOf('}');
    if (braceStart >= 0 && braceEnd > braceStart) {
      try {
        return JSON.parse(text.substring(braceStart, braceEnd + 1));
      } catch {
        // 最后尝试：清理常见问题
        const cleaned = text
          .substring(braceStart, braceEnd + 1)
          .replace(/,\s*([}\]])/g, '$1') // 移除尾随逗号
          .replace(/[\u0000-\u001F]+/g, ' ') // 移除控制字符
          .replace(/"\s*\n\s*"/g, '" "') // 修复跨行字符串
        ;
        try {
          return JSON.parse(cleaned);
        } catch {
          console.warn('[ArticleExtractionV2] JSON 解析失败，返回空对象');
          return {};
        }
      }
    }
    return {};
  }
}

/**
 * 将V2提取结果转化为可入库的素材列表
 * 每个关系型素材生成一条素材记录
 */
export function extractionV2ToMaterialInputs(
  result: ArticleExtractionResultV2,
  sourceArticleTitle: string
): Array<{
  type: string;
  sceneType: string;
  title: string;
  content: string;
  topicTags: string[];
  sceneTags: string[];
  emotionTags: string[];
  sourceType: string;
  structuredData: Record<string, unknown>;
}> {
  const materials: Array<{
    type: string;
    sceneType: string;
    title: string;
    content: string;
    topicTags: string[];
    sceneTags: string[];
    emotionTags: string[];
    sourceType: string;
    structuredData: Record<string, unknown>;
  }> = [];

  const baseTopicTags = [result.coreTheme].filter(Boolean);
  const baseEmotionTags = [result.emotionalTone].filter(Boolean);

  // 素材类型 → material_library.type 映射
  const materialTypeToLibType: Record<string, string> = {
    misconception: 'story',
    analogy: 'case',
    case: 'case',
    data: 'data',
    golden_sentence: 'quote',
    fixed_phrase: 'quote',
    personal_fragment: 'quote',
  };

  // 素材类型 → material_library.sceneType 映射
  const materialTypeToSceneType: Record<string, string> = {
    misconception: 'misconception',
    analogy: 'analogy',
    case: 'real_case',
    data: 'authority_data',
    golden_sentence: 'golden_sentence',
    fixed_phrase: 'fixed_phrase',
    personal_fragment: 'personal_fragment',
  };

  for (const m of result.relationalMaterials) {
    const typeLabel = MATERIAL_TYPE_LABELS[m.materialType] || m.materialType;
    const contentPreview = m.content.substring(0, 30);

    materials.push({
      type: materialTypeToLibType[m.materialType] || 'case',
      sceneType: materialTypeToSceneType[m.materialType] || 'real_case',
      title: `${typeLabel}: ${contentPreview}...`,
      content: m.content,
      topicTags: [...baseTopicTags, ...m.topicTags],
      sceneTags: [...m.sceneTags, typeLabel],
      emotionTags: [...baseEmotionTags, m.emotion].filter(Boolean),
      sourceType: 'article',
      structuredData: {
        materialType: m.materialType,
        position: m.position,
        contextBefore: m.contextBefore,
        contextAfter: m.contextAfter,
        emotion: m.emotion,
        relationToPrevious: m.relationToPrevious,
        paradigmStep: m.paradigmStep,
        paradigmId: result.paradigmRecognition.matchedParadigmId,
        paradigmName: result.paradigmRecognition.matchedParadigmName,
        sourceArticle: sourceArticleTitle,
        version: 'v2',
      },
    });
  }

  return materials;
}

// ============================================================
// 向后兼容：保留V1类型定义（已废弃，仅供参考）
// ============================================================

/** @deprecated 使用 ArticleExtractionResultV2 替代 */
export interface ArticleExtractionResult {
  layer1: Record<string, unknown>;
  layer2: Record<string, unknown>;
  layer3: Record<string, unknown>;
  layer4: Record<string, unknown>;
  layer5: Record<string, unknown>;
}
