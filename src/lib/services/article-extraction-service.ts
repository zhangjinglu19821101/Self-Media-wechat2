/**
 * 文章全维度提取服务 - 5层21维结构化提取
 * 
 * 将一篇文章从"不可复用的单篇内容"拆解为5层21个可标准化提取的结构单元，
 * 每个单元都能转化为可无限复用的数字资产。
 */

import { callLLM } from '@/lib/agent-llm';

// ===================== 类型定义 =====================

/** 第一层：文章元信息层 */
export interface Layer1MetaInfo {
  articleTitle: string;           // 主标题
  subtitle?: string;              // 副标题
  alternativeTitles?: string[];   // 备选标题
  articleType: string;            // 客户误区型/事件驱动型/行业新认知型
  coreTheme: string;              // 核心主题
  targetAudience: string;         // 目标人群
  emotionalTone: string;          // 情感基调
  publishPlatform: string;        // 发布平台
  publishTime?: string;           // 发布时间
}

/** 第二层：核心逻辑层 */
export interface Layer2CoreLogic {
  coreArgument: string;           // 核心论点
  breakthroughLogic: string;      // 破局逻辑（标准错位点）
  argumentStructure: string;      // 论证结构
  valueProposition: string;       // 价值主张
  actionGuide: string;            // 行动指引
}

/** 第三层：内容模块层 */
export interface Layer3ContentModules {
  hookIntro: string;              // 钩子引入
  emotionalAcceptance: string;    // 情绪接纳
  cognitiveBreakthrough: string;  // 认知破局
  plainExplanation: string;       // 通俗解释
  valueReconstruction: string;    // 价值重构
  closingElevation: string;       // 收尾升华
}

/** 第四层：语言风格层 */
export interface Layer4LanguageStyle {
  fixedPatterns: string[];        // 固定句式
  toneCharacteristics: string[];  // 语气特征
  catchphrases: string[];         // 个人口头禅
  forbiddenWords: string[];       // 禁忌词汇
  paragraphRhythm: string;        // 段落节奏
}

/** 第五层：原子素材单元层 */
export interface Layer5AtomicMaterials {
  misconceptions: string[];       // 错误认知
  lifeAnalogies: string[];        // 生活类比
  realCases: string[];            // 真实案例
  authorityData: string[];        // 权威数据
  goldenSentences: string[];      // 金句提炼
}

/** 完整5层提取结果 */
export interface ArticleExtractionResult {
  layer1: Layer1MetaInfo;
  layer2: Layer2CoreLogic;
  layer3: Layer3ContentModules;
  layer4: Layer4LanguageStyle;
  layer5: Layer5AtomicMaterials;
  extractionSummary: string;      // 提取总结
  assetValueScore: number;        // 资产价值评分（0-100）
  reusableDimensionCount: number; // 可复用维度数
}

// ===================== 提取 Prompt =====================

const EXTRACTION_SYSTEM_PROMPT = `你是一位专业的保险科普文章结构化提取专家。你的任务是将一篇保险科普文章拆解为5层21个可标准化提取的结构单元。

## 提取原则
1. **忠实原文**：提取内容必须来源于文章，不得编造
2. **结构化输出**：严格按照5层21维的结构输出
3. **可复用优先**：每个提取单元都应该是可以独立复用的"写作零件"
4. **量化评分**：给出资产价值评分和可复用维度数

## 5层21维提取体系

### 第一层：文章元信息层（基础属性，用于分类与检索）
- articleTitle: 主标题
- subtitle: 副标题（如有）
- alternativeTitles: 备选标题（提炼2-3个替代标题）
- articleType: 文章类型，必须从以下选项中选择：
  - "客户误区型"（纠正客户错误认知）
  - "事件驱动型"（由热点事件引出保险话题）
  - "行业新认知型"（传递行业新观点/新趋势）
- coreTheme: 核心主题（如"增额寿回本逻辑"、"重疾险理赔困境"）
- targetAudience: 目标人群（如"30-40岁宝妈"、"高净值人群"）
- emotionalTone: 情感基调，必须从以下选项中选择：
  - "共情式破局" / "理性客观" / "踩坑警醒" / "专业权威"
- publishPlatform: 发布平台（公众号/小红书/抖音/朋友圈等）
- publishTime: 发布时间（如有）

### 第二层：核心逻辑层（文章骨架，决定论证路径）
- coreArgument: 核心论点（文章要传递的唯一核心观点，一句话概括）
- breakthroughLogic: 破局逻辑（核心逻辑漏洞/标准错位点，说明文章如何打破读者固有认知）
- argumentStructure: 论证结构（完整的论证步骤，如"共情式破局7步"）
- valueProposition: 价值主张（文章最终传递的底层价值观）
- actionGuide: 行动指引（文章结尾引导读者的具体行动）

### 第三层：内容模块层（文章血肉，可独立复用）
- hookIntro: 钩子引入（文章开头吸引注意力的部分，原文摘录+分析）
- emotionalAcceptance: 情绪接纳（消除对立感、建立信任的部分）
- cognitiveBreakthrough: 认知破局（点出核心逻辑漏洞的部分）
- plainExplanation: 通俗解释（用类比和案例讲透道理的部分）
- valueReconstruction: 价值重构（重新定义"好"与"坏"标准的部分）
- closingElevation: 收尾升华（文章结尾的金句和灵魂拷问）

### 第四层：语言风格层（文章灵魂，个人签名）
- fixedPatterns: 固定句式（作者高频使用的标志性句式，至少提取3个）
- toneCharacteristics: 语气特征（语速、节奏、用词习惯等，至少3个）
- catchphrases: 个人口头禅（如"说实话"、"我常说"等）
- forbiddenWords: 禁忌词汇（文章中绝对不出现的词汇和表达类型）
- paragraphRhythm: 段落节奏（段落长度分布、换行习惯、标点使用特点）

### 第五层：原子素材单元层（最小价值单元，核心数字财富）
- misconceptions: 错误认知（大众的错误观点原话，一字不差）
- lifeAnalogies: 生活类比（生活化的比喻和同构场景）
- realCases: 真实案例（个人经历、客户案例、新闻事件）
- authorityData: 权威数据（行业数据、官方统计、政策文件）
- goldenSentences: 金句提炼（可以独立传播的精华句子）

## 评分标准
- assetValueScore: 资产价值评分（0-100）
  - 90-100: 5层全部有丰富可复用内容
  - 70-89: 大部分维度有可复用内容
  - 50-69: 部分维度有可复用内容
  - 0-49: 可复用内容较少
- reusableDimensionCount: 21个维度中有实质内容的维度数量

## 输出格式
严格按照JSON格式输出，不要添加任何额外文本。`;

// ===================== 核心服务 =====================

/**
 * 从文章内容中提取5层21维结构化数据
 */
export async function extractArticleDimensions(
  articleContent: string,
  articleTitle?: string,
  options?: { workspaceId?: string }
): Promise<ArticleExtractionResult> {
  const userPrompt = `请对以下保险科普文章进行5层21维全维度结构化提取：

${articleTitle ? `## 文章标题：${articleTitle}\n\n` : ''}## 文章内容：
${articleContent}

---

请严格按照5层21维提取体系输出JSON结果。确保每个维度都有提取内容，如果原文中确实没有对应内容，填写"未检测到"并说明原因。`;

  try {
    const response = await callLLM(
      'article-extractor',
      EXTRACTION_SYSTEM_PROMPT,
      userPrompt,
      {
        maxTokens: 8000,
        temperature: 0.1,
        timeout: 180000,
        workspaceId: options?.workspaceId,
      }
    );

    // 解析LLM返回的JSON
    const result = parseExtractionResponse(response);
    return result;
  } catch (error) {
    console.error('[ArticleExtractionService] 提取失败:', error);
    throw new Error(`文章全维度提取失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 解析LLM返回的提取结果
 */
function parseExtractionResponse(response: string): ArticleExtractionResult {
  // 尝试从响应中提取JSON
  let jsonStr = response.trim();
  
  // 移除可能的markdown代码块包裹
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  
  // 尝试找到JSON对象的边界
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(jsonStr);
    
    // 构建标准化的提取结果，确保所有字段都有默认值
    const result: ArticleExtractionResult = {
      layer1: {
        articleTitle: parsed.layer1?.articleTitle || parsed.articleTitle || '',
        subtitle: parsed.layer1?.subtitle || '',
        alternativeTitles: parsed.layer1?.alternativeTitles || [],
        articleType: normalizeArticleType(parsed.layer1?.articleType),
        coreTheme: parsed.layer1?.coreTheme || '',
        targetAudience: parsed.layer1?.targetAudience || '',
        emotionalTone: normalizeEmotionalTone(parsed.layer1?.emotionalTone),
        publishPlatform: parsed.layer1?.publishPlatform || '公众号',
        publishTime: parsed.layer1?.publishTime || '',
      },
      layer2: {
        coreArgument: parsed.layer2?.coreArgument || '',
        breakthroughLogic: parsed.layer2?.breakthroughLogic || '',
        argumentStructure: parsed.layer2?.argumentStructure || '',
        valueProposition: parsed.layer2?.valueProposition || '',
        actionGuide: parsed.layer2?.actionGuide || '',
      },
      layer3: {
        hookIntro: parsed.layer3?.hookIntro || '',
        emotionalAcceptance: parsed.layer3?.emotionalAcceptance || '',
        cognitiveBreakthrough: parsed.layer3?.cognitiveBreakthrough || '',
        plainExplanation: parsed.layer3?.plainExplanation || '',
        valueReconstruction: parsed.layer3?.valueReconstruction || '',
        closingElevation: parsed.layer3?.closingElevation || '',
      },
      layer4: {
        fixedPatterns: ensureArray(parsed.layer4?.fixedPatterns),
        toneCharacteristics: ensureArray(parsed.layer4?.toneCharacteristics),
        catchphrases: ensureArray(parsed.layer4?.catchphrases),
        forbiddenWords: ensureArray(parsed.layer4?.forbiddenWords),
        paragraphRhythm: parsed.layer4?.paragraphRhythm || '',
      },
      layer5: {
        misconceptions: ensureArray(parsed.layer5?.misconceptions),
        lifeAnalogies: ensureArray(parsed.layer5?.lifeAnalogies),
        realCases: ensureArray(parsed.layer5?.realCases),
        authorityData: ensureArray(parsed.layer5?.authorityData),
        goldenSentences: ensureArray(parsed.layer5?.goldenSentences),
      },
      extractionSummary: parsed.extractionSummary || '',
      assetValueScore: typeof parsed.assetValueScore === 'number' ? parsed.assetValueScore : 50,
      reusableDimensionCount: typeof parsed.reusableDimensionCount === 'number' ? parsed.reusableDimensionCount : 0,
    };

    // 自动计算可复用维度数
    result.reusableDimensionCount = countReusableDimensions(result);

    return result;
  } catch (parseError) {
    console.error('[ArticleExtractionService] JSON解析失败:', parseError);
    console.error('[ArticleExtractionService] 原始响应:', response.substring(0, 500));
    throw new Error(`提取结果JSON解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }
}

// ===================== 辅助函数 =====================

const VALID_ARTICLE_TYPES = ['客户误区型', '事件驱动型', '行业新认知型'];

function normalizeArticleType(value: string | undefined): string {
  if (!value) return '客户误区型';
  const found = VALID_ARTICLE_TYPES.find(t => value.includes(t));
  return found || '客户误区型';
}

const VALID_EMOTIONAL_TONES = ['共情式破局', '理性客观', '踩坑警醒', '专业权威'];

function normalizeEmotionalTone(value: string | undefined): string {
  if (!value) return '理性客观';
  const found = VALID_EMOTIONAL_TONES.find(t => value.includes(t));
  return found || '理性客观';
}

function ensureArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value) return [value];
  return [];
}

function countReusableDimensions(result: ArticleExtractionResult): number {
  let count = 0;
  const l1 = result.layer1;
  if (l1.articleTitle) count++;
  if (l1.articleType) count++;
  if (l1.coreTheme) count++;
  if (l1.targetAudience) count++;
  if (l1.emotionalTone) count++;
  if (l1.publishPlatform) count++;
  
  const l2 = result.layer2;
  if (l2.coreArgument) count++;
  if (l2.breakthroughLogic) count++;
  if (l2.argumentStructure) count++;
  if (l2.valueProposition) count++;
  if (l2.actionGuide) count++;
  
  const l3 = result.layer3;
  if (l3.hookIntro) count++;
  if (l3.emotionalAcceptance) count++;
  if (l3.cognitiveBreakthrough) count++;
  if (l3.plainExplanation) count++;
  if (l3.valueReconstruction) count++;
  if (l3.closingElevation) count++;
  
  const l4 = result.layer4;
  if (l4.fixedPatterns.length > 0) count++;
  if (l4.toneCharacteristics.length > 0) count++;
  if (l4.catchphrases.length > 0) count++;
  if (l4.forbiddenWords.length > 0) count++;
  if (l4.paragraphRhythm) count++;
  
  const l5 = result.layer5;
  if (l5.misconceptions.length > 0) count++;
  if (l5.lifeAnalogies.length > 0) count++;
  if (l5.realCases.length > 0) count++;
  if (l5.authorityData.length > 0) count++;
  if (l5.goldenSentences.length > 0) count++;
  
  return count;
}

/**
 * 将提取结果转化为可入库的素材列表
 * 每个有实质内容的维度生成一条素材记录
 */
export function extractionToMaterialInputs(
  result: ArticleExtractionResult,
  sourceArticleTitle: string
): Array<{
  type: string;
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
    title: string;
    content: string;
    topicTags: string[];
    sceneTags: string[];
    emotionTags: string[];
    sourceType: string;
    structuredData: Record<string, unknown>;
  }> = [];

  const baseTopicTags = [result.layer1.coreTheme].filter(Boolean);
  const baseEmotionTags = [result.layer1.emotionalTone].filter(Boolean);

  // 第二层素材化
  if (result.layer2.coreArgument) {
    materials.push({
      type: 'analogy',
      title: `核心论点: ${result.layer2.coreArgument.substring(0, 30)}...`,
      content: result.layer2.coreArgument,
      topicTags: [...baseTopicTags, '核心论点'],
      sceneTags: ['观点提炼'],
      emotionTags: baseEmotionTags,
      sourceType: 'article_extraction',
      structuredData: { layer: 2, dimension: 'coreArgument', sourceArticle: sourceArticleTitle },
    });
  }

  if (result.layer2.breakthroughLogic) {
    materials.push({
      type: 'misconception',
      title: `破局逻辑: ${result.layer2.breakthroughLogic.substring(0, 30)}...`,
      content: result.layer2.breakthroughLogic,
      topicTags: [...baseTopicTags, '破局逻辑'],
      sceneTags: ['逻辑错位'],
      emotionTags: baseEmotionTags,
      sourceType: 'article_extraction',
      structuredData: { layer: 2, dimension: 'breakthroughLogic', sourceArticle: sourceArticleTitle },
    });
  }

  // 第五层素材化（最核心的数字财富）
  for (const misconception of result.layer5.misconceptions) {
    materials.push({
      type: 'misconception',
      title: `误区: ${misconception.substring(0, 30)}...`,
      content: misconception,
      topicTags: [...baseTopicTags, '客户误区'],
      sceneTags: ['误区反驳'],
      emotionTags: ['踩坑警醒'],
      sourceType: 'article_extraction',
      structuredData: { layer: 5, dimension: 'misconception', sourceArticle: sourceArticleTitle },
    });
  }

  for (const analogy of result.layer5.lifeAnalogies) {
    materials.push({
      type: 'analogy',
      title: `类比: ${analogy.substring(0, 30)}...`,
      content: analogy,
      topicTags: [...baseTopicTags, '生活类比'],
      sceneTags: ['通俗解释'],
      emotionTags: baseEmotionTags,
      sourceType: 'article_extraction',
      structuredData: { layer: 5, dimension: 'lifeAnalogy', sourceArticle: sourceArticleTitle },
    });
  }

  for (const caseItem of result.layer5.realCases) {
    materials.push({
      type: 'case',
      title: `案例: ${caseItem.substring(0, 30)}...`,
      content: caseItem,
      topicTags: [...baseTopicTags, '真实案例'],
      sceneTags: ['案例支撑'],
      emotionTags: baseEmotionTags,
      sourceType: 'article_extraction',
      structuredData: { layer: 5, dimension: 'realCase', sourceArticle: sourceArticleTitle },
    });
  }

  for (const dataItem of result.layer5.authorityData) {
    materials.push({
      type: 'data',
      title: `数据: ${dataItem.substring(0, 30)}...`,
      content: dataItem,
      topicTags: [...baseTopicTags, '权威数据'],
      sceneTags: ['数据支撑'],
      emotionTags: ['专业权威'],
      sourceType: 'article_extraction',
      structuredData: { layer: 5, dimension: 'authorityData', sourceArticle: sourceArticleTitle },
    });
  }

  for (const sentence of result.layer5.goldenSentences) {
    materials.push({
      type: 'quote',
      title: `金句: ${sentence.substring(0, 30)}...`,
      content: sentence,
      topicTags: [...baseTopicTags, '金句'],
      sceneTags: ['收尾升华', '开头引入'],
      emotionTags: baseEmotionTags,
      sourceType: 'article_extraction',
      structuredData: { layer: 5, dimension: 'goldenSentence', sourceArticle: sourceArticleTitle },
    });
  }

  // 第四层风格素材化
  for (const pattern of result.layer4.fixedPatterns) {
    materials.push({
      type: 'quote',
      title: `固定句式: ${pattern.substring(0, 30)}...`,
      content: pattern,
      topicTags: [...baseTopicTags, '语言风格'],
      sceneTags: ['句式复用'],
      emotionTags: baseEmotionTags,
      sourceType: 'article_extraction',
      structuredData: { layer: 4, dimension: 'fixedPattern', sourceArticle: sourceArticleTitle },
    });
  }

  return materials;
}
