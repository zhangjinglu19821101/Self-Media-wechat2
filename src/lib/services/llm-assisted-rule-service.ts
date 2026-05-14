/**
 * LLM 辅助规则提取服务 (LLMAssistedRuleService)
 *
 * Phase 5 核心能力 — 对于纯规则难以处理的场景，引入 LLM 辅助分析
 *
 * 能力矩阵：
 * 1. 情绪分类 (classifyEmotion) — 分析文章情绪基调
 * 2. 修改意图理解 (extractRuleFromFeedback) — 从用户反馈中提炼风格规则
 * 3. 核心立场聚类 (clusterCoreStances) — 从历史观点中提炼反复出现的立场主题
 * 4. 样本风格特征提取 (extractStyleProfile) — 分析标杆文章的风格特征
 *
 * 设计约束：
 * - 使用轻量模型（doubao-seed-1-6-lite / doubao-seed-2-0-mini）控制成本
 * - 结果默认 isValidated=false，需人工确认后激活
 * - 单次调用超时 30 秒，失败不阻塞主流程
 */

import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { createUserLLMClient, getPlatformLLM } from '@/lib/llm/factory';
import type { StyleDepositionResult } from './style-deposition-service';

// ========== 类型定义 ==========

/** 情绪分类结果 */
export interface EmotionClassificationResult {
  /** 主导情绪 */
  primaryEmotion: 'empathetic' | 'rational' | 'warning' | 'warm' | 'professional' | 'neutral';
  /** 置信度 0~1 */
  confidence: number;
  /** 辅助情绪标签 */
  secondaryTags: string[];
  /** 原始分析文本 */
  analysisText: string;
}

/** 反馈规则提取结果 */
export interface FeedbackRuleExtractionResult {
  /** 提取出的规则类型 */
  ruleType: 'vocabulary' | 'forbidden_supplement' | 'structure_supplement' | 'emotion' | 'logic' | 'core_stance';
  /** 规则内容 */
  ruleContent: string;
  /** 规则类别（正向/负向） */
  ruleCategory: 'positive' | 'negative';
  /** 置信度 0~1 */
  confidence: number;
  /** 提取依据摘要 */
  reasoning: string;
}

/** 核心立场聚类结果 */
export interface CoreStanceClusterResult {
  /** 聚类出的立场主题列表 */
  stances: Array<{
    theme: string;
    description: string;
    frequency: number;
    exampleOpinions: string[];
  }>;
  /** 总分析条目数 */
  totalAnalyzed: number;
  /** 聚类摘要文本 */
  summary: string;
}

/** 风格特征画像结果 */
export interface StyleProfileResult {
  /** 语气特征 */
  tone: {
    primary: string;
    secondary: string[];
    formalityLevel: 'formal' | 'semi-formal' | 'casual';
  };
  /** 句式偏好 */
  sentencePatterns: {
    avgLength: number;
    dominantPatterns: string[];
    rhetoricalDeviceUsage: Record<string, number>;
  };
  /** 用词习惯 */
  vocabularyHabits: {
    highFrequencyWords: string[];
    domainSpecificTerms: string[];
    emotionalMarkers: string[];
  };
  /** 结构化描述 */
  structuredProfile: string;
  /** 原始分析文本 */
  rawAnalysis: string;
}

// ========== Prompt 模板 ==========

const PROMPTS = {
  /**
   * 情绪分类 Prompt
   * 输入：文章全文
   * 输出：JSON { primaryEmotion, confidence, secondaryTags, analysis }
   */
  classifyEmotion: `你是一位专业的文本情感分析师。请分析以下文章的情绪基调。

请从以下选项中选择最匹配的主导情绪：
- empathetic（共情/温情）：充满同理心、温暖、关怀读者感受
- rational（理性/客观）：冷静分析、数据驱动、逻辑严密
- warning（警示/踩坑）：强调风险、警示语气、紧迫感强
- warm（温情/感性）：柔和亲切、故事化表达、情感共鸣
- professional（专业/权威）：专家口吻、严谨规范、行业深度
- neutral（中性/平衡）：无明显情绪倾向

请以严格的 JSON 格式返回（不要包含其他文字）：
{
  "primaryEmotion": "选择的情绪类型",
  "confidence": 0.0~1.0的置信度,
  "secondaryTags": ["辅助情绪标签1", "辅助情绪标签2"],
  "analysis": "简短分析说明（50字以内）"
}

待分析文章：
`,

  /**
   * 修改意图理解 Prompt
   * 输入：用户反馈原文 + 文章上下文（可选）
   * 输出：JSON { ruleType, ruleContent, ruleCategory, confidence, reasoning }
   */
  extractRuleFromFeedback: `你是一位写作风格分析师。用户对AI生成的文章给出了修改反馈，请你从中提炼出一条可复用的风格规则。

规则类型映射：
- vocabulary: 用户希望增加或减少某些词汇的使用
- forbidden_supplement: 用户指出不应使用的表述方式
- structure_supplement: 用户希望调整文章结构或段落组织方式
- emotion: 用户希望改变文章的情感基调或语气
- logic: 用户希望调整论证逻辑或推理方式
- core_stance: 用户希望强化或弱化某个核心观点

请以严格的 JSON 格式返回（不要包含其他文字）：
{
  "ruleType": "上述类型之一",
  "ruleContent": "提炼出的具体规则内容（可直接写入风格库）",
  "ruleCategory": "positive(正向建议) 或 negative(负向禁止)",
  "confidence": 0.0~1.0的置信度,
  "reasoning": "从反馈到规则的推导过程（50字以内）"
}

用户反馈原文：
`,

  /**
   * 核心立场聚类 Prompt
   * 输入：最近 N 条 userOpinion 列表
   * 输出：JSON { stances[], totalAnalyzed, summary }
   */
  clusterCoreStances: `你是一位内容策略分析师。以下是用户最近提出的多条创作指令/核心观点，请从中识别反复出现的立场主题。

请执行以下步骤：
1. 阅读所有观点，识别共同的主题方向
2. 将相似的观点归类为同一立场主题
3. 为每个主题命名并给出简要描述
4. 统计每个主题的出现频率
5. 选出最具代表性的 3-5 个主题

请以严格的 JSON 格式返回（不要包含其他文字）：
{
  "stances": [
    {
      "theme": "立场主题名称（如：风险意识优先）",
      "description": "该立场的详细描述",
      "frequency": 出现次数,
      "exampleOpinions": ["代表性观点1", "代表性观点2"]
    }
  ],
  "totalAnalyzed": 总条数,
  "summary": "整体趋势总结（100字以内）"
}

用户历史观点列表：
`,

  /**
   * 样本风格特征提取 Prompt
   * 输入：标杆样本全文
   * 输出：JSON { tone, sentencePatterns, vocabularyHabits, structuredProfile }
   */
  extractStyleProfile: `你是一位专业的文体分析专家。请深入分析以下文章的风格特征，生成结构化的风格画像。

分析维度：
1. 语气特征：主导语气、辅助语气、正式程度
2. 句式偏好：平均句长、主要句式模式、修辞手法使用频率
3. 用词习惯：高频词汇、领域术语、情感标记词

请以严格的 JSON 格式返回（不要包含其他文字）：
{
  "tone": {
    "primary": "主导语气（如：理性客观/温情共情/专业权威/警示提醒）",
    "secondary": ["辅助语气1", "辅助语气2"],
    "formalityLevel": "formal / semi-formal / casual"
  },
  "sentencePatterns": {
    "avgLength": 平均句长数字,
    "dominantPatterns": ["主要句式模式1", "主要句式模式2"],
    "rhetoricalDeviceUsage": {"反问句": 使用次数, "排比句": 使用次数, "设问句": 使用次数}
  },
  "vocabularyHabits": {
    "highFrequencyWords": ["高频词1", "高频词2", "...最多10个"],
    "domainSpecificTerms": ["领域术语1", "领域术语2", "...最多5个"],
    "emotionalMarkers": ["情感标记词1", "情感标记词2", "...最多5个"]
  },
  "structuredProfile": "一段自然语言总结该文章的整体风格特征（150字以内）"
}

待分析的标杆文章：
`,
};

// ========== 服务类 ==========

export class LLMAssistedRuleService {
  private static instance: LLMAssistedRuleService | null = null;

  static getInstance(): LLMAssistedRuleService {
    if (!LLMAssistedRuleService.instance) {
      LLMAssistedRuleService.instance = new LLMAssistedRuleService();
    }
    return LLMAssistedRuleService.instance;
  }

  private client: LLMClient;

  constructor() {
    const config = new Config({ timeout: 30000 }); // 30秒超时
    this.client = new LLMClient(config);
  }

  /**
   * 获取 LLM 客户端（按 workspace llmKeySource 策略）
   * 无 workspaceId 时直接使用平台 Key（后台任务场景）
   */
  private async getClient(workspaceId?: string): Promise<LLMClient> {
    if (workspaceId) {
      const { client } = await createUserLLMClient(workspaceId, { timeout: 30000 });
      return client;
    }
    return getPlatformLLM();
  }

  // ================================================================
  // 能力1：情绪分类
  // ================================================================

  /**
   * 分析文章的情绪基调
   *
   * @param articleText - 文章纯文本（已去除 HTML）
   * @param options - 可选配置
   * @returns 情绪分类结果
   */
  async classifyEmotion(
    articleText: string,
    options?: { model?: string; workspaceId?: string }
  ): Promise<EmotionClassificationResult> {
    const truncatedText = articleText.substring(0, 8000); // 控制输入长度
    const client = await this.getClient(options?.workspaceId);

    console.log('[LLMRule] 开始情绪分类', { textLength: truncatedText.length });

    try {
      const response = await client.invoke(
        [
          { role: 'user', content: `${PROMPTS.classifyEmotion}\n${truncatedText}` },
        ],
        {
          model: options?.model || 'doubao-seed-2-0-mini-260215',
          temperature: 0.3, // 低温度保证输出稳定
        }
      );

      return this.parseEmotionResponse(response.content);

    } catch (error) {
      console.error('[LLMRule] 情绪分类失败:', error instanceof Error ? error.message : String(error));
      // 降级返回中性（不暴露内部错误信息到持久化数据）
      return {
        primaryEmotion: 'neutral',
        confidence: 0,
        secondaryTags: [],
        analysisText: 'LLM调用失败，降级为中性判断',
      };
    }
  }

  // ================================================================
  // 能力2：修改意图理解（从用户反馈中提取规则）
  // ================================================================

  /**
   * 从用户反馈中提取可复用的风格规则
   *
   * @param feedbackText - 用户反馈原文
   * @param contextArticle - 相关文章上下文（可选）
   * @param options - 可选配置
   * @returns 规则提取结果
   */
  async extractRuleFromFeedback(
    feedbackText: string,
    contextArticle?: string,
    options?: { model?: string; workspaceId?: string }
  ): Promise<FeedbackRuleExtractionResult> {
    const client = await this.getClient(options?.workspaceId);
    let prompt = `${PROMPTS.extractRuleFromFeedback}\n${feedbackText}`;

    if (contextArticle && contextArticle.length > 20) {
      prompt += `\n\n相关文章片段（供参考）：\n${contextArticle.substring(0, 2000)}`;
    }

    console.log('[LLMRule] 开始反馈规则提取', { feedbackLength: feedbackText.length });

    try {
      const response = await client.invoke(
        [{ role: 'user', content: prompt }],
        {
          model: options?.model || 'doubao-seed-2-0-mini-260215',
          temperature: 0.2, // 更低温度确保精确提取
        }
      );

      return this.parseFeedbackRuleResponse(response.content);

    } catch (error) {
      console.error('[LLMRule] 反馈规则提取失败:', error instanceof Error ? error.message : String(error));
      return {
        ruleType: 'vocabulary',
        ruleContent: feedbackText.substring(0, 200), // 截断避免存储过长原始文本
        ruleCategory: 'negative',
        confidence: 0,
        reasoning: 'LLM调用失败，降级为原始反馈文本存储',
      };
    }
  }

  // ================================================================
  // 能力3：核心立场聚类
  // ================================================================

  /**
   * 从历史用户观点中聚类出反复出现的立场主题
   *
   * @param userOpinions - 最近 N 条 userOpinion 列表
   * @param options - 可选配置
   * @returns 立场聚类结果
   */
  async clusterCoreStances(
    userOpinions: string[],
    options?: { model?: string; maxItems?: number; workspaceId?: string }
  ): Promise<CoreStanceClusterResult> {
    const client = await this.getClient(options?.workspaceId);
    const maxItems = options?.maxItems || 20;
    const opinions = userOpinions.slice(0, maxItems).filter(o => o && o.trim().length > 5);

    if (opinions.length < 2) {
      return {
        stances: [],
        totalAnalyzed: opinions.length,
        summary: '观点数量不足，无法进行聚类分析',
      };
    }

    const formattedList = opinions.map((o, i) => `${i + 1}. ${o}`).join('\n');

    console.log('[LLMRule] 开始核心立场聚类', { opinionCount: opinions.length });

    try {
      const response = await client.invoke(
        [{ role: 'user', content: `${PROMPTS.clusterCoreStances}\n${formattedList}` }],
        {
          model: options?.model || 'doubao-seed-2-0-mini-260215',
          temperature: 0.4,
        }
      );

      return this.parseStanceClusterResponse(response.content);

    } catch (error) {
      console.error('[LLMRule] 核心立场聚类失败:', error instanceof Error ? error.message : String(error));
      return {
        stances: [],
        totalAnalyzed: opinions.length,
        summary: 'LLM调用失败，无法进行聚类分析',
      };
    }
  }

  // ================================================================
  // 能力4：样本风格特征提取
  // ================================================================

  /**
   * 分析标杆文章的风格特征，生成结构化画像
   *
   * @param sampleArticle - 标杆样本文章全文
   * @param options - 可选配置
   * @returns 风格特征画像
   */
  async extractStyleProfile(
    sampleArticle: string,
    options?: { model?: string; workspaceId?: string }
  ): Promise<StyleProfileResult> {
    const client = await this.getClient(options?.workspaceId);
    const truncatedText = sampleArticle.substring(0, 8000);

    console.log('[LLMRule] 开始风格特征提取', { textLength: truncatedText.length });

    try {
      const response = await client.invoke(
        [{ role: 'user', content: `${PROMPTS.extractStyleProfile}\n${truncatedText}` }],
        {
          model: options?.model || 'doubao-seed-2-0-mini-260215',
          temperature: 0.3,
        }
      );

      return this.parseStyleProfileResponse(response.content);

    } catch (error) {
      console.error('[LLMRule] 风格特征提取失败:', error instanceof Error ? error.message : String(error));
      return {
        tone: { primary: 'unknown', secondary: [], formalityLevel: 'semi-formal' },
        sentencePatterns: { avgLength: 0, dominantPatterns: [], rhetoricalDeviceUsage: {} },
        vocabularyHabits: { highFrequencyWords: [], domainSpecificTerms: [], emotionalMarkers: [] },
        structuredProfile: '',
        rawAnalysis: `LLM调用失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // ================================================================
  // 批量处理：将 FeedbackRuleExtractionResult 转换为 StyleDepositionResult
  // ================================================================

  /**
   * 将 LLM 提取的反馈规则转换为可持久化的 StyleDepositionResult 格式
   */
  convertToDepositionResult(extraction: FeedbackRuleExtractionResult): StyleDepositionResult {
    return {
      ruleType: extraction.ruleType,
      ruleContent: extraction.ruleContent,
      ruleCategory: extraction.ruleCategory,
      sourceType: 'auto_llm', // 标记来源为 LLM 自动提取
      confidence: String(extraction.confidence),
      sampleExtract: extraction.reasoning,
      priority: extraction.confidence > 0.8 ? 1 : extraction.confidence > 0.5 ? 2 : 3,
    };
  }

  // ================================================================
  // JSON 解析器（带容错和清理）
  // ================================================================

  /**
   * 解析情绪分类响应
   */
  private parseEmotionResponse(raw: string): EmotionClassificationResult {
    const cleaned = this.extractJSON(raw);
    try {
      const parsed = JSON.parse(cleaned);
      const validEmotions = ['empathetic', 'rational', 'warning', 'warm', 'professional', 'neutral'];
      return {
        primaryEmotion: validEmotions.includes(parsed.primaryEmotion) ? parsed.primaryEmotion : 'neutral',
        confidence: typeof parsed.confidence === 'number' ? Math.min(Math.max(parsed.confidence, 0), 1) : 0.5,
        secondaryTags: Array.isArray(parsed.secondaryTags) ? parsed.secondaryTags : [],
        analysisText: typeof parsed.analysis === 'string' ? parsed.analysis : raw.substring(0, 200),
      };
    } catch {
      console.warn('[LLMRule] 情绪分类 JSON 解析失败，原始响应:', raw.substring(0, 200));
      return {
        primaryEmotion: 'neutral',
        confidence: 0,
        secondaryTags: [],
        analysisText: raw.substring(0, 200),
      };
    }
  }

  /**
   * 解析反馈规则提取响应
   */
  private parseFeedbackRuleResponse(raw: string): FeedbackRuleExtractionResult {
    const cleaned = this.extractJSON(raw);
    try {
      const parsed = JSON.parse(cleaned);
      const validTypes = ['vocabulary', 'forbidden_supplement', 'structure_supplement', 'emotion', 'logic', 'core_stance'];
      return {
        ruleType: validTypes.includes(parsed.ruleType) ? parsed.ruleType : 'vocabulary',
        ruleContent: typeof parsed.ruleContent === 'string' ? parsed.ruleContent : raw.substring(0, 200),
        ruleCategory: ['positive', 'negative'].includes(parsed.ruleCategory) ? parsed.ruleCategory : 'negative',
        confidence: typeof parsed.confidence === 'number' ? Math.min(Math.max(parsed.confidence, 0), 1) : 0.5,
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
      };
    } catch {
      console.warn('[LLMRule] 反馈规则 JSON 解析失败，原始响应:', raw.substring(0, 200));
      return {
        ruleType: 'vocabulary',
        ruleContent: raw.substring(0, 200),
        ruleCategory: 'negative',
        confidence: 0.3,
        reasoning: 'JSON解析失败，降级为原始文本存储',
      };
    }
  }

  /**
   * 解析立场聚类响应
   */
  private parseStanceClusterResponse(raw: string): CoreStanceClusterResult {
    const cleaned = this.extractJSON(raw);
    try {
      const parsed = JSON.parse(cleaned);
      return {
        stances: Array.isArray(parsed.stances)
          ? parsed.stances.map((s: any) => ({
              theme: s.theme || '',
              description: s.description || '',
              frequency: typeof s.frequency === 'number' ? s.frequency : 1,
              exampleOpinions: Array.isArray(s.exampleOpinions) ? s.exampleOpinions : [],
            }))
          : [],
        totalAnalyzed: typeof parsed.totalAnalyzed === 'number' ? parsed.totalAnalyzed : 0,
        summary: typeof parsed.summary === 'string' ? parsed.summary : raw.substring(0, 200),
      };
    } catch {
      console.warn('[LLMRule] 立场聚类 JSON 解析失败');
      return { stances: [], totalAnalyzed: 0, summary: raw.substring(0, 200) };
    }
  }

  /**
   * 解析风格特征响应
   */
  private parseStyleProfileResponse(raw: string): StyleProfileResult {
    const cleaned = this.extractJSON(raw);
    try {
      const parsed = JSON.parse(cleaned);
      return {
        tone: {
          primary: parsed.tone?.primary || 'unknown',
          secondary: Array.isArray(parsed.tone?.secondary) ? parsed.tone.secondary : [],
          formalityLevel: ['formal', 'semi-formal', 'casual'].includes(parsed.tone?.formalityLevel)
            ? parsed.tone.formalityLevel : 'semi-formal',
        },
        sentencePatterns: {
          avgLength: typeof parsed.sentencePatterns?.avgLength === 'number'
            ? parsed.sentencePatterns.avgLength : 0,
          dominantPatterns: Array.isArray(parsed.sentencePatterns?.dominantPatterns)
            ? parsed.sentencePatterns.dominantPatterns : [],
          rhetoricalDeviceUsage: typeof parsed.sentencePatterns?.rhetoricalDeviceUsage === 'object'
            ? parsed.sentencePatterns.rhetoricalDeviceUsage : {},
        },
        vocabularyHabits: {
          highFrequencyWords: Array.isArray(parsed.vocabularyHabits?.highFrequencyWords)
            ? parsed.vocabularyHabits.highFrequencyWords.slice(0, 15) : [],
          domainSpecificTerms: Array.isArray(parsed.vocabularyHabits?.domainSpecificTerms)
            ? parsed.vocabularyHabits.domainSpecificTerms.slice(0, 10) : [],
          emotionalMarkers: Array.isArray(parsed.vocabularyHabits?.emotionalMarkers)
            ? parsed.vocabularyHabits.emotionalMarkers.slice(0, 10) : [],
        },
        structuredProfile: typeof parsed.structuredProfile === 'string' ? parsed.structuredProfile : '',
        rawAnalysis: raw,
      };
    } catch {
      console.warn('[LLMRule] 风格特征 JSON 解析失败');
      return {
        tone: { primary: 'unknown', secondary: [], formalityLevel: 'semi-formal' },
        sentencePatterns: { avgLength: 0, dominantPatterns: [], rhetoricalDeviceUsage: {} },
        vocabularyHabits: { highFrequencyWords: [], domainSpecificTerms: [], emotionalMarkers: [] },
        structuredProfile: '',
        rawAnalysis: raw,
      };
    }
  }

  /**
   * 从 LLM 响应中提取 JSON（处理 markdown 代码块包裹等情况）
   */
  private extractJSON(raw: string): string {
    let text = raw.trim();

    // 处理 ```json ... ``` 包裹
    const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      text = jsonBlockMatch[1].trim();
    }

    // 如果不是以 { 开头，尝试找到第一个 {
    if (!text.startsWith('{')) {
      const braceIndex = text.indexOf('{');
      if (braceIndex !== -1) {
        text = text.substring(braceIndex);
      }
    }

    // 找到最后一个 }
    if (!text.endsWith('}')) {
      const lastBraceIndex = text.lastIndexOf('}');
      if (lastBraceIndex !== -1) {
        text = text.substring(0, lastBraceIndex + 1);
      }
    }

    return text;
  }
}

// ========== 导出单例实例 ==========
export const llmAssistedRuleService = LLMAssistedRuleService.getInstance();
