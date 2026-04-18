/**
 * 风格沉淀服务 (StyleDepositionService)
 *
 * Phase 4 核心沉淀能力 — 从定稿文章中自动提取用词习惯和风格特征
 *
 * 能力矩阵：
 * 1. 高频词统计 — 分词 + 词频计数 + 停用词过滤 → Top N 高频词
 * 2. 禁用词维护 — 否定句式检测 + 黑名单写入 style_assets
 * 3. 句式习惯统计 — 反问句/短句比例 + 段落长度分布
 *
 * 数据流向：
 *   定稿文章文本 → extractHighFrequencyWords() → StyleAssetInsert[] → 写入 style_assets
 *   用户反馈文本 → extractForbiddenPatterns() → StyleAssetInsert[] → 写入 style_assets
 */

import { db } from '@/lib/db';
import { styleAssets, coreAnchorAssets } from '@/lib/db/schema/digital-assets';
import { agentSubTasks } from '@/lib/db/schema'; // Phase 4: 查询已完成文章
import { WRITING_AGENTS } from '@/lib/agents/agent-registry';
import { eq, and, or, isNull, gte, desc, inArray } from 'drizzle-orm';
import type { NewStyleAsset } from '@/lib/db/schema/digital-assets';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { createUserLLMClient, getPlatformLLM } from '@/lib/llm/factory';
import type {
  OverallToneAnalysis,
  ToneAndVoiceAnalysis,
  ExpressionHabitsAnalysis,
  ContentDetailAnalysis,
  FormattingStyleAnalysis,
  SixDimensionAnalysis,
} from '@/types/style-analysis';

// ========== 类型定义 ==========

/** 沉淀结果条目（可写入 style_assets） */
export interface StyleDepositionResult {
  ruleType: 'vocabulary' | 'forbidden_supplement' | 'structure_supplement' | 'emotion' | 'logic' | 'core_stance';
  ruleContent: string;
  ruleCategory: 'positive' | 'negative';
  sourceType: 'auto_nlp' | 'llm_assist'; // 对齐 digital-assets.ts schema: manual/auto_nlp/feedback/llm_assist
  confidence: string; // Drizzle numeric 需要 string 类型
  sampleExtract?: string;
  priority?: number; // 可选，默认0
  metadata?: Record<string, unknown>; // 扩展元数据，用于存储维度分析详情
}

/** 高频词提取选项 */
export interface HighFrequencyWordOptions {
  /** 最大返回数量 */
  topN?: number;
  /** 最小词长 */
  minWordLength?: number;
  /** 最小出现次数 */
  minFrequency?: number;
}

/** 句式分析结果 */
export interface SentencePatternAnalysis {
  totalSentences: number;
  avgSentenceLength: number;
  rhetoricalQuestionRatio: number; // 反问句比例
  shortSentenceRatio: number; // 短句比例(≤20字)
  longSentenceRatio: number; // 长句比例(≥50字)
  patterns: Array<{
    type: string;
    count: number;
    ratio: number;
    examples: string[];
  }>;
}

/** 沉淀任务执行摘要 */
export interface DepositionSummary {
  processedArticles: number;
  extractedWords: number;
  newRulesCreated: number;
  updatedRules: number;
  errors: string[];
  executionTimeMs: number;
  /** 🔥 新增：风格相似度校验跳过的文章数 */
  skippedByStyleValidation?: number;
  /** 🔥 新增：风格相似度校验警告 */
  styleWarnings?: string[];
}

// ========== 常量 ==========

/** 中文停用词表（扩展版，用于高频词过滤） */
const STOP_WORDS: ReadonlySet<string> = new Set([
  // 代词
  '我们', '你们', '他们', '她们', '它们', '自己', '这', '那', '这个', '那个',
  '这些', '那些', '什么', '怎么', '如何', '为什么', '哪里', '哪个', '哪些',
  '多少', '某', '本', '该', '其', '之', '者',
  // 助词
  '的', '了', '着', '过', '得', '地', '吗', '呢', '吧', '啊', '呀', '嘛',
  '罢了', '而已', '似的', '一样', '一般',
  // 介词
  '在', '从', '向', '往', '对', '为', '以', '把', '被', '让', '给', '比',
  '按', '按照', '由于', '对于', '关于', '通过', '除了',
  // 连词
  '和', '与', '或', '而', '但', '但是', '然而', '如果', '虽然', '因为',
  '所以', '因此', '于是', '并且', '以及', '或者', '还是', '不仅', '而且',
  '无论', '不管', '除非', '只要', '即使', '尽管', '与其', '宁可',
  // 副词
  '很', '太', '非常', '特别', '比较', '稍微', '仅仅', '只', '就', '都',
  '也', '还', '已经', '正在', '将要', '曾经', '一直', '总是', '常常',
  '偶尔', '通常', '一般', '大约', '大概', '几乎', '确实', '究竟', '毕竟',
  '其实', '当然', '显然', '果然', '居然', '竟然', '或许', '恐怕', '未必',
  // 动词（高频通用）
  '是', '有', '可以', '能够', '需要', '应该', '希望', '认为', '表示',
  '进行', '通过', '实现', '达到', '获得', '提供', '包括', '涉及', '关于',
  '根据', '使得', '说明', '告诉', '知道', '了解', '看到', '发现', '出现',
  '发生', '产生', '引起', '导致', '造成', '形成', '成为', '保持', '继续',
  // 形容词（高频通用）
  '重要', '主要', '关键', '基本', '一定', '相同', '不同', '很多', '更多',
  '更大', '更好', '更少', '较小', '较大', '其他', '有关', '相关', '可能',
  '容易', '困难', '简单', '复杂', '明显', '清楚', '明确', '具体',
  // 数量词
  '一个', '一些', '某种', '每个', '各位', '大家', '两者', '之一',
  // 时间词
  '今天', '明天', '昨天', '现在', '当时', '同时', '之前', '之后', '期间',
  '时候', '目前', '以来', '以后', '以前', '然后', '接着', '首先', '其次',
]);

/** 通用高频词表（与差集后得到用户专属词汇） */
const COMMON_WORDS: ReadonlySet<string> = new Set([
  ...STOP_WORDS,
  // 额外添加极高频的通用中文词汇
  '保险', '客户', '产品', '公司', '服务', '管理', '发展', '社会', '问题',
  '系统', '技术', '数据', '信息', '用户', '市场', '企业', '行业', '业务',
  '工作', '人员', '项目', '方案', '过程', '方法', '方式', '情况', '内容',
  '条件', '因素', '原因', '结果', '效果', '影响', '关系', '特点', '优势',
  '价值', '需求', '选择', '决定', '考虑', '注意', '保证', '支持', '帮助',
  '提高', '降低', '增加', '减少', '改变', '改善', '促进', '推动', '建立',
  '进行', '实现', '完成', '开始', '结束', '继续', '保持', '需要', '应该',
  '可以', '必须', '能够', '希望', '认为', '表示', '说明', '包括', '涉及',
  '根据', '关于', '通过', '对于', '以及', '或者', '因此', '所以', '但是',
  '然而', '如果', '虽然', '即使', '无论', '不管', '除非', '只要', '一旦',
]);

/** 句式模式定义 */
const SENTENCE_PATTERNS = [
  {
    type: 'rhetorical_question',
    label: '反问句',
    pattern: /[^？。！\n]*[难道|岂不|何尝|何曾|哪能|怎么][^？]*？/g,
    description: '反问句式',
  },
  {
    type: 'parallel_structure',
    label: '排比句',
    pattern: /([^，。！？\n]{10,30}[，、])\1{2,}/g,
    description: '排比结构',
  },
  {
    type: 'hypothetical',
    label: '假设句',
    pattern: /(?:如果|假如|假设|若|要是)[^。]{5,}(?:那么|则|就)/g,
    description: '假设推论句式',
  },
  {
    type: 'contrast',
    label: '转折句',
    pattern: /[^。]{8,}(?:但|但是|然而|不过|可是|却)[^。]{8,}/g,
    description: '转折对比句式',
  },
];

/** 否定句式模式（用于禁用词提取） */
const NEGATIVE_PATTERNS = [
  { pattern: /不要[^。]{2,20}/g, label: '否定祈使' },
  { pattern: /避免[^。]{2,20}/g, label: '避免类' },
  { pattern: /切忌[^。]{2,20}/g, label: '切忌类' },
  { pattern: /禁止[^。]{2,20}/g, label: '禁止类' },
  { pattern: /不能[^。]{2,20}/g, label: '不能类' },
  { pattern: /不该[^。]{2,20}/g, label: '不该类' },
  { pattern: /切勿[^。]{2,20}/g, label: '切勿类' },
  { pattern: /尽量[^。]{2,20}?(?:不要|避免|少)/g, label: '尽量避免' },
];

/** L2: 绝对化表达正则（维度②焦虑检测 + 维度④禁用词共享） */
export const ABSOLUTE_WORD_PATTERNS = [
  '最', '100%', '保本', '绝对', '一定', '必须', '第一', '唯一',
];

// ═══════════════════════════════════════════════════
// 6 维度扩展类型（从统一类型文件 re-export，供外部模块引用）
// 统一类型定义见: src/types/style-analysis.ts
// ═══════════════════════════════════════════════════

// ========== 服务类 ==========

export class StyleDepositionService {
  private static instance: StyleDepositionService | null = null;

  static getInstance(): StyleDepositionService {
    if (!StyleDepositionService.instance) {
      StyleDepositionService.instance = new StyleDepositionService();
    }
    return StyleDepositionService.instance;
  }

  /**
   * 清理 HTML 标签，保留纯文本
   * 用于各维度分析前的文本预处理
   */
  private cleanHtml(text: string): string {
    return text
      .replace(/<br\s*\/?>/gi, '\n')
      // L3: 先处理连续 <p> 标签（避免产生多余空行），再替换单个 </p>
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      // 清理多余空行（2个以上连续换行压缩为1个）
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // ================================================================
  // 能力1：高频词统计
  // ================================================================

  /**
   * 从文章文本中提取高频词汇
   *
   * 流程：
   * 1. 合并所有输入文本
   * 2. 中文分词（纯JS实现，无需外部依赖）
   * 3. 词频统计 + 停用词过滤
   * 4. 取 Top N
   * 5. 与通用高频词表做差集 → 用户专属高频词
   *
   * @param articleTexts - 文章文本数组
   * @param options - 提取选项
   * @returns 可写入 style_assets 的规则数组
   */
  async extractHighFrequencyWords(
    articleTexts: string[],
    options: HighFrequencyWordOptions = {}
  ): Promise<StyleDepositionResult[]> {
    const {
      topN = 30,
      minWordLength = 2,
      minFrequency = 2,
    } = options;

    if (!articleTexts || articleTexts.length === 0) {
      console.log('[StyleDeposition] ⚠️ 输入文章列表为空');
      return [];
    }

    const startTime = Date.now();

    // 1. 合并文本
    const fullText = articleTexts.join('\n');
    console.log('[StyleDeposition] 开始高频词提取', {
      articleCount: articleTexts.length,
      totalChars: fullText.length,
    });

    // 2. 分词
    const words = this.tokenize(fullText);
    console.log(`[StyleDeposition] 分词完成，共 ${words.length} 个词元`);

    // 3. 词频统计 + 过滤
    const freqMap = new Map<string, number>();
    for (const word of words) {
      if (
        word.length >= minWordLength &&
        !STOP_WORDS.has(word) &&
        !/^[\d\s]+$/.test(word) && // 排除纯数字
        !/^[\x00-\xff]+$/.test(word)  // 排除纯ASCII
      ) {
        freqMap.set(word, (freqMap.get(word) || 0) + 1);
      }
    }

    // 4. 取 Top N（按频率降序）
    const sorted = [...freqMap.entries()]
      .filter(([, count]) => count >= minFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN * 2); // 多取一些，后续差集后再截断

    // 5. 与通用高频词表做差集 → 用户专属高频词
    const userUniqueWords = sorted.filter(([word]) => !COMMON_WORDS.has(word));
    const topUnique = userUniqueWords.slice(0, topN);

    // 6. 转换为 StyleDepositionResult 格式
    const results: StyleDepositionResult[] = topUnique.map(([word, count], index) => ({
      ruleType: 'vocabulary' as const,
      ruleContent: `高频使用词汇：「${word}」`,
      ruleCategory: 'positive' as const,
      sourceType: 'auto_nlp' as const,
      confidence: String(Math.min(count / articleTexts.length * 3, 1)), // 归一化到 0-1
      sampleExtract: word,
      priority: index < 10 ? 1 : index < 20 ? 2 : 3, // 前10个最高优先级
    }));

    console.log('[StyleDeposition] 高频词提取完成', {
      totalUnique: userUniqueWords.length,
      extractedCount: results.length,
      elapsedMs: Date.now() - startTime,
      top5: topUnique.slice(0, 5).map(([w, c]) => `${w}(${c})`),
    });

    return results;
  }

  /**
   * 纯 JS 中文分词（基于词典的最大正向匹配）
   *
   * 不依赖 node-jieba，兼容性更好。
   * 使用内置常用词典 + 统计共现规律辅助分词。
   */
  private tokenize(text: string): string[] {
    const tokens: string[] = [];

    // 预处理：去除 HTML 标签和多余空白
    const cleanText = text
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, '')
      .trim();

    let i = 0;
    while (i < cleanText.length) {
      // 尝试匹配最长词（最大长度 6 字符）
      let matched = false;

      for (let len = Math.min(6, cleanText.length - i); len >= 2; len--) {
        const substr = cleanText.substring(i, i + len);

        // 检查是否是纯中文字符串且在停用词表中或看起来像有效词
        if (/^[\u4e00-\u9fa5]+$/.test(substr)) {
          tokens.push(substr);
          i += len;
          matched = true;
          break;
        }
      }

      if (!matched) {
        // 单字符：如果是中文则保留，否则跳过
        const char = cleanText[i];
        if (/[\u4e00-\u9fa5]/.test(char)) {
          tokens.push(char);
        }
        i++;
      }
    }

    return tokens;
  }

  // ================================================================
  // 能力2：禁用词/否定模式提取
  // ================================================================

  /**
   * 从用户反馈或文章中提取禁用模式和否定表达
   *
   * @param texts - 反馈文本或文章文本数组
   * @returns 禁用规则列表
   */
  async extractForbiddenPatterns(texts: string[]): Promise<StyleDepositionResult[]> {
    if (!texts || texts.length === 0) return [];

    const results: StyleDepositionResult[] = [];
    const combinedText = texts.join('\n');

    for (const { pattern, label } of NEGATIVE_PATTERNS) {
      const matches = combinedText.match(pattern);
      if (!matches || matches.length === 0) continue;

      // 去重
      const uniqueMatches = [...new Set(matches)];

      for (const match of uniqueMatches.slice(0, 3)) { // 每种模式最多取3条
        results.push({
          ruleType: 'forbidden_supplement',
          ruleContent: match.trim(),
          ruleCategory: 'negative',
          sourceType: 'auto_nlp',
          confidence: '0.70',
          sampleExtract: `[${label}] ${match.trim()}`,
          priority: 2,
        });
      }
    }

    console.log('[StyleDeposition] 提取到禁用模式', {
      patternCount: results.length,
      types: [...new Set(results.map(r => r.ruleContent.slice(0, 10)))],
    });

    return results;
  }

  // ================================================================
  // 能力3：句式习惯分析
  // ================================================================

  /**
   * 分析文章的句式特征和写作习惯
   *
   * @param text - 文章文本
   * @returns 句式分析结果
   */
  analyzeSentencePatterns(text: string): SentencePatternAnalysis {
    // 按句子分割（中英文句号、感叹号、问号）
    const sentences = this.splitSentences(text);

    const totalSentences = sentences.length;
    const lengths = sentences.map(s => s.replace(/\s/g, '').length);
    const avgSentenceLength = totalSentences > 0
      ? Math.round(lengths.reduce((a, b) => a + b, 0) / totalSentences)
      : 0;

    // 短句(≤20字) 和 长句(≥50字) 比例
    const shortCount = lengths.filter(l => l > 0 && l <= 20).length;
    const longCount = lengths.filter(l => l >= 50).length;

    // 各特殊句式统计
    const patterns = SENTENCE_PATTERNS.map(({ type, label, pattern }) => {
      const matches = text.match(pattern) || [];
      return {
        type,
        label,
        count: matches.length,
        ratio: totalSentences > 0 ? Math.round(matches.length / totalSentences * 1000) / 1000 : 0,
        examples: matches.slice(0, 2).map(m => m.trim().substring(0, 40)),
      };
    }).filter(p => p.count > 0);

    return {
      totalSentences,
      avgSentenceLength,
      rhetoricalQuestionRatio:
        patterns.find(p => p.type === 'rhetorical_question')?.ratio ?? 0,
      shortSentenceRatio:
        totalSentences > 0 ? Math.round(shortCount / totalSentences * 1000) / 1000 : 0,
      longSentenceRatio:
        totalSentences > 0 ? Math.round(longCount / totalSentences * 1000) / 1000 : 0,
      patterns,
    };
  }

  /**
   * 将句式分析结果转换为风格规则（用于写入 style_assets）
   */
  convertPatternsToRules(analysis: SentencePatternAnalysis): StyleDepositionResult[] {
    const rules: StyleDepositionResult[] = [];

    // 反问句偏好
    if (analysis.rhetoricalQuestionRatio > 0.05) {
      rules.push({
        ruleType: 'structure_supplement',
        ruleContent: `偏好使用反问句式（占比${(analysis.rhetoricalQuestionRatio * 100).toFixed(1)}%），建议适当保留`,
        ruleCategory: 'positive',
        sourceType: 'auto_nlp',
        confidence: String(Math.min(analysis.rhetoricalQuestionRatio * 5, 1)),
        sampleExtract: analysis.patterns
          .find(p => p.type === 'rhetorical_question')
          ?.examples.join('; ') ?? '',
        priority: 3,
      });
    }

    // 短句偏好
    if (analysis.shortSentenceRatio > 0.3) {
      rules.push({
        ruleType: 'logic',
        ruleContent: `偏好短句表达（短句占比${(analysis.shortSentenceRatio * 100).toFixed(1)}%），节奏明快`,
        ruleCategory: 'positive',
        sourceType: 'auto_nlp',
        confidence: String(Math.min(analysis.shortSentenceRatio * 2, 1)),
        priority: 3,
      });
    }

    // 平均句长参考
    if (analysis.avgSentenceLength > 0) {
      rules.push({
        ruleType: 'structure_supplement',
        ruleContent: `平均句长约${analysis.avgSentenceLength}字，保持此句长风格`,
        ruleCategory: 'positive',
        sourceType: 'auto_nlp',
        confidence: '0.60',
        priority: 3,
      });
    }

    return rules;
  }

  // ================================================================
  // 持久化：将沉淀结果写入数据库
  // ================================================================

  /**
   * 批量保存沉淀结果到 style_assets 表
   *
   * 🔴 Phase4修复(#7): 从 N+1 查询优化为批量操作（2次查询 + N次写入）
   * 原实现: N条结果 × (1 SELECT + 1 INSERT/UPDATE) = 最多2N次DB调用
   * 新实现: 1次批量SELECT(OR条件) → 分离新增/更新 → 1次批量INSERT + M次UPDATE
   *
   * @param results - 沉淀结果列表
   * @param userId - 用户ID（可选）
   * @returns 创建/更新的数量
   */
  async saveDepositionResults(
    results: StyleDepositionResult[],
    userId?: string,
    templateId?: string // 🔥 新增：支持绑定到模板
  ): Promise<{ created: number; updated: number }> {
    if (!results || results.length === 0) {
      return { created: 0, updated: 0 };
    }

    let created = 0;
    let updated = 0;

    try {
      // 🔴 Step 1: 构建所有 (ruleType, ruleContent) 组合键的 OR 条件，一次查询所有已存在记录
      const dedupKeys = results.map(r => ({
        ruleType: r.ruleType,
        ruleContent: r.ruleContent,
      }));

      // 使用 OR 条件批量查询（单次 DB 调用）
      const orConditions = dedupKeys.map(key =>
        and(
          eq(styleAssets.ruleType, key.ruleType),
          eq(styleAssets.ruleContent, key.ruleContent),
          or(eq(styleAssets.sourceType, 'auto_nlp'), eq(styleAssets.sourceType, 'llm_assist')),
        )
      );

      // 分批查询（避免 OR 条件过多导致 SQL 过长）
      const BATCH_SIZE = 50;
      const allExisting: typeof styleAssets.$inferSelect[] = [];
      for (let i = 0; i < orConditions.length; i += BATCH_SIZE) {
        const batchOr = orConditions.slice(i, i + BATCH_SIZE);
        if (batchOr.length === 1) {
          const batchResult = await db.select().from(styleAssets).where(batchOr[0]);
          allExisting.push(...batchResult);
        } else {
          const batchResult = await db.select().from(styleAssets).where(or(...batchOr));
          allExisting.push(...batchResult);
        }
      }

      // 🔴 Step 2: 构建查找映射表 (ruleType|ruleContent → record)
      const existingMap = new Map<string, typeof styleAssets.$inferSelect>();
      for (const rec of allExisting) {
        existingMap.set(`${rec.ruleType}|${rec.ruleContent}`, rec);
      }

      // 🔴 Step 3: 分离为"需要插入"和"需要更新"两批
      const toInsert: StyleDepositionResult[] = [];
      const toUpdate: Array<{ result: StyleDepositionResult; existingId: string; existingPriority: number }> = [];

      for (const result of results) {
        const mapKey = `${result.ruleType}|${result.ruleContent}`;
        const existing = existingMap.get(mapKey);

        if (existing) {
          // 已存在：仅当新置信度更高时才更新
          const existingConfidence = parseFloat(existing.confidence);
          const newConfidence = parseFloat(result.confidence);
          if (newConfidence > existingConfidence) {
            toUpdate.push({ result, existingId: existing.id, existingPriority: existing.priority });
          }
        } else {
          // 不存在：待插入
          toInsert.push(result);
        }
      }

      // 🔴 Step 4: 批量插入新记录（单次 DB 调用）
      if (toInsert.length > 0) {
        await db.insert(styleAssets).values(
          toInsert.map(r => ({
            ruleType: r.ruleType,
            ruleContent: r.ruleContent,
            ruleCategory: r.ruleCategory,
            sourceType: r.sourceType,
            confidence: r.confidence,
            sampleExtract: r.sampleExtract,
            priority: r.priority ?? 3, // 🔥 修复：默认优先级为 3
            isActive: true,
            workspaceId: userId ?? null, // 🔥 Phase 6 修复：字段名从 userId 改为 workspaceId
            templateId: templateId ?? null, // 🔥 新增：绑定到模板
          }) as NewStyleAsset)
        );
        created = toInsert.length;
      }

      // 🔴 Step 5: 批量更新已有记录（M 次 DB 调用，但通常远少于 N）
      for (const { result, existingId, existingPriority } of toUpdate) {
        // 🔥 修复：处理 priority 为 undefined 的情况
        const newPriority = result.priority ?? 3; // 默认优先级为 3
        await db
          .update(styleAssets)
          .set({
            confidence: result.confidence,
            priority: Math.min(newPriority, existingPriority),
            updatedAt: new Date(),
          })
          .where(eq(styleAssets.id, existingId));
        updated++;
      }

    } catch (error) {
      // 🔥 增强：打印完整错误对象，便于排查
      console.error('[StyleDeposition] 批量保存失败:', error instanceof Error ? error.message : String(error));
      if (error instanceof Error && 'cause' in error) {
        console.error('[StyleDeposition] 错误原因:', (error as any).cause);
      }
      if (error && typeof error === 'object') {
        console.error('[StyleDeposition] 完整错误对象:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      }
      // 降级：逐条保存兜底
      console.warn('[StyleDeposition] 降级为逐条保存模式');
      for (const result of results) {
        try {
          const existing = await db
            .select()
            .from(styleAssets)
            .where(
              and(
                eq(styleAssets.ruleType, result.ruleType),
                eq(styleAssets.ruleContent, result.ruleContent),
                or(eq(styleAssets.sourceType, 'auto_nlp'), eq(styleAssets.sourceType, 'llm_assist')),
              )
            )
            .limit(1);

          if (existing.length > 0) {
            const existingConfidence = parseFloat(existing[0].confidence);
            const newConfidence = parseFloat(result.confidence);
            if (newConfidence > existingConfidence) {
              // 🔥 修复：处理 priority 为 undefined 的情况
              const newPriority = result.priority ?? 3;
              await db.update(styleAssets)
                .set({
                  confidence: result.confidence,
                  priority: Math.min(newPriority, existing[0].priority),
                  updatedAt: new Date(),
                })
                .where(eq(styleAssets.id, existing[0].id));
              updated++;
            }
          } else {
            await db.insert(styleAssets).values({
              ruleType: result.ruleType,
              ruleContent: result.ruleContent,
              ruleCategory: result.ruleCategory,
              sourceType: result.sourceType,
              confidence: result.confidence,
              sampleExtract: result.sampleExtract,
              priority: result.priority ?? 3, // 🔥 修复：默认优先级为 3
              isActive: true,
              workspaceId: userId ?? null, // 🔥 Phase 6 修复：字段名从 userId 改为 workspaceId
            } as NewStyleAsset);
            created++;
          }
        } catch (singleError) {
          console.error('[StyleDeposition] 逐条保存失败:', {
            error: singleError instanceof Error ? singleError.message : String(singleError),
            ruleType: result.ruleType,
            ruleContent: result.ruleContent.substring(0, 50),
          });
        }
      }
    }

    console.log('[StyleDeposition] 批量保存完成', { created, updated, total: results.length });
    return { created, updated };
  }

  // ================================================================
  // 定时聚合能力
  // ================================================================

  // ═══════════════════════════════════════════════════
  // 6 维度扩展：新增 5 个维度分析方法
  // ═══════════════════════════════════════════════════

  /**
   * 维度①：风格画像分析（LLM 驱动 → analyzeToneProfile）
   * 从消费者立场、产品中立性、专业度、温度感、避坑导向 5 个维度评分
   * 
   * @param workspaceId - 可选，定时任务不传递时使用平台 Key
   */
  async analyzeToneProfile(articleText: string, workspaceId?: string): Promise<OverallToneAnalysis> {
    try {
      // 按 workspace llmKeySource 策略获取 LLM Client
      let llm: Awaited<ReturnType<typeof createUserLLMClient>>['client'];
      if (workspaceId) {
        const result = await createUserLLMClient(workspaceId, { timeout: 30000 });
        llm = result.client;
      } else {
        llm = getPlatformLLM();
      }

      const prompt = `你是一位专业的写作风格分析师。请分析以下保险科普文章的整体调性，从5个维度各打1-10分（10分为最高）。

分析维度：
1. consumerStance（消费者立场）：是否站在消费者角度说话，替用户着想
2. productNeutrality（产品中立性）：是否避免推销具体产品，保持客观中立
3. professionalism（专业性）：是否有理有据，引用权威数据
4. warmth（温度感）：是否有共情和人文关怀，不冷冰冰
5. pitfallFocus（避坑导向）：是否以避坑科普为核心，而非推销导向

文章内容（前6000字）：
${articleText.substring(0, 6000)}

请严格返回JSON格式，不要返回其他内容：
{
  "consumerStance": 数字,
  "productNeutrality": 数字,
  "professionalism": 数字,
  "warmth": 数字,
  "pitfallFocus": 数字,
  "overallTone": "一句话总结整体调性",
  "summary": "2-3句话详细说明各维度的表现"
}`;

      const result = await llm.invoke(
        [{ role: 'user', content: prompt }],
        { model: 'doubao-seed-1-6-lite-251015', temperature: 0.2 }
      );
      const text = typeof result === 'string' ? result : (result as any).content || JSON.stringify(result);
      const cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as OverallToneAnalysis;
      }
    } catch (error) {
      console.warn('[StyleDeposition] 整体调性分析失败:', error instanceof Error ? error.message : String(error));
    }
    return {
      consumerStance: 0, productNeutrality: 0, professionalism: 0,
      warmth: 0, pitfallFocus: 0,
      overallTone: '分析失败', summary: 'LLM调用失败，无法分析整体调性',
    };
  }

  /**
   * 维度②：语言风格分析（NLP 规则 + 统计 → analyzeLanguageStyle）
   * 检测代词使用（你/咱们/您/贵/客户）、口语化程度、焦虑/夸大程度
   */
  analyzeLanguageStyle(text: string): ToneAndVoiceAnalysis {
    const cleanText = this.cleanHtml(text);

    // 代词统计（使用分词结果确保词边界准确，避免正则误匹配复合词中的子串）
    // 例如："你们好" 中不应单独计数 "你"，而应只计数独立的 "你"
    const tokens = this.tokenize(cleanText);
    let niCount = 0;
    let ninCount = 0;
    let ninmenCount = 0;
    let ninGuaiguiCount = 0;
    let kehuCount = 0;

    for (const token of tokens) {
      switch (token) {
        case '你': niCount++; break;
        case '咱们': ninCount++; break;
        case '你们': ninmenCount++; break;
        case '您':
        case '贵': ninGuaiguiCount++; break;
        case '客户': kehuCount++; break;
        default: break;
      }
    }
    const totalPronouns = niCount + ninCount + ninmenCount + ninGuaiguiCount + kehuCount;

    // 口语化标记词密度（L1 修复：去重 "吗"）
    const colloquialMarkers = /呢|吧|呀|嘛|呗|哈|哎|哦|嗯|啊/g;
    const colloquialMatches = cleanText.match(colloquialMarkers) || [];
    const colloquialismScore = Math.min(1, colloquialMatches.length / Math.max(cleanText.length / 50, 1));

    // 夸大/绝对化词密度（焦虑指标）— L2: 使用共享常量
    const anxietyRegex = new RegExp(ABSOLUTE_WORD_PATTERNS.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
    const anxietyMatches = cleanText.match(anxietyRegex) || [];
    const anxietyLevel = Math.min(1, anxietyMatches.length / Math.max(cleanText.length / 200, 1));

    // 正式度判断
    let formalityLevel: 'informal' | 'neutral' | 'formal' = 'neutral';
    if (colloquialismScore > 0.15 && ninGuaiguiCount === 0) formalityLevel = 'informal';
    if (colloquialismScore < 0.05 && ninGuaiguiCount > 0) formalityLevel = 'formal';

    const summaryParts: string[] = [];
    if (niCount > 3) summaryParts.push(`使用「你」${niCount}次，亲切感强`);
    if (ninGuaiguiCount > 0) summaryParts.push(`使用「您/贵」${ninGuaiguiCount}次，偏正式`);
    if (kehuCount > 0) summaryParts.push(`使用「客户」${kehuCount}次，偏销售口吻`);
    if (anxietyLevel > 0.3) summaryParts.push('存在夸大/绝对化表达');
    if (colloquialismScore > 0.2) summaryParts.push('口语化程度较高');

    return {
      pronounStats: { niCount, ninCount, ninmenCount, ninGuaiguiCount, kehuCount, totalPronouns },
      colloquialismScore: Math.round(colloquialismScore * 100) / 100,
      anxietyLevel: Math.round(anxietyLevel * 100) / 100,
      formalityLevel,
      summary: summaryParts.join('；') || '语气表达较为中性',
    };
  }

  /**
   * 维度④：词汇分析（增强版 → analyzeVocabulary）
   * 提取高频特色词、检测绝对化禁用词、分类行业词汇（避坑/保障/行动）
   */
  analyzeVocabulary(text: string): ExpressionHabitsAnalysis {
    const cleanText = this.cleanHtml(text);

    // 高频词（使用内部 tokenize + 词频统计，同步实现）
    const tokens = this.tokenize(cleanText);
    const freqMap = new Map<string, number>();
    for (const word of tokens) {
      if (
        word.length >= 2 &&
        !STOP_WORDS.has(word) &&
        !/^[\d\s]+$/.test(word) &&
        !/^[\x00-\xff]+$/.test(word)
      ) {
        freqMap.set(word, (freqMap.get(word) || 0) + 1);
      }
    }
    const highFrequencyWords = Array.from(freqMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));

    // 禁用词检测（内联实现）
    const negativePatterns = [
      { pattern: /不[要该买能]/g, label: '否定句式' },
      { pattern: /[最绝首一].*[好优佳]/g, label: '最高级' },
      { pattern: /(100%|百分之百|绝对|肯定|无疑)/g, label: '绝对化' },
    ];
    const forbiddenWords = negativePatterns.map(({ pattern, label }) => ({
      pattern: label,
      matches: Array.from(cleanText.match(pattern) || []).slice(0, 3),
      count: (cleanText.match(pattern) || []).length,
    })).filter(f => f.count > 0);

    // 绝对化词汇检测（L2: 使用共享常量 ABSOLUTE_WORD_PATTERNS）
    const absoluteWords = ABSOLUTE_WORD_PATTERNS.map(word => ({
      word,
      count: (cleanText.match(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length,
    })).filter(w => w.count > 0);

    // 自定义行业词汇分类
    const customCategories: Record<string, RegExp[]> = {
      '避坑类': [/踩坑/g, /避坑/g, /门道/g, /算笔明白账/g],
      '保障类': [/兜底/g, /护身符/g, /安全垫/g],
      '行动类': [/别急/g, /先别/g, /听我说/g],
    };
    const customVocabulary: Array<{ word: string; category: string; count: number }> = [];
    for (const [category, patterns] of Object.entries(customCategories)) {
      for (const pattern of patterns) {
        const matches = cleanText.match(pattern) || [];
        if (matches.length > 0) {
          customVocabulary.push({ word: pattern.source.replace(/\/g$/, ''), category, count: matches.length });
        }
      }
    }

    const summaryParts: string[] = [];
    if (highFrequencyWords.length > 0) {
      summaryParts.push(`高频词TOP3: ${highFrequencyWords.slice(0, 3).map(w => w.word).join('、')}`);
    }
    if (absoluteWords.length > 0) {
      summaryParts.push(`绝对化词汇出现${absoluteWords.reduce((s, w) => s + w.count, 0)}次`);
    }
    if (customVocabulary.length > 0) {
      summaryParts.push(`行业特色词: ${customVocabulary.map(v => v.word).join('、')}`);
    }

    return {
      highFrequencyWords,
      forbiddenWords,
      absoluteWords,
      customVocabulary,
      summary: summaryParts.join('；') || '未检测到显著的表达习惯特征',
    };
  }

  /**
   * 维度⑤：内容规范检查（实体白名单 → analyzeContentNorms）
   * 检查案例命名是否匿名化、数据源是否官方、文末是否有合规声明
   */
  analyzeContentNorms(text: string): ContentDetailAnalysis {
    const cleanText = this.cleanHtml(text);

    // 白名单：允许使用的匿名案例名
    const allowedCaseNames = /(阿姨|邻居|大爷|大妈|同事|朋友|队友|同学|亲戚|表姐|发小|哥们|闺蜜)/g;
    const caseNames: string[] = [...new Set<string>((cleanText.match(allowedCaseNames) || []).map(m => m))];

    // 白名单：允许使用的官方数据源
    const allowedSources = /(银保监会|金融监管总局|国家金融监督管理总局|央行|人民银行|统计局|国家统计局|癌症中心|国家癌症中心|扶贫办|卫健委|卫生健康委|社保局|人社部|财政部|发改委)/g;
    const officialSources: string[] = [...new Set<string>((cleanText.match(allowedSources) || []).map(m => m))];

    // 检测不在白名单中的案例名（可能是真实姓名）
    const suspiciousCasePattern = /(?:张|王|李|刘|陈|杨|赵|黄|周|吴)[\u4e00-\u9fa5](?:先生|女士|小姐|总|经理|老师|医生)/g;
    const nonCompliantCaseNames: string[] = [...new Set<string>((cleanText.match(suspiciousCasePattern) || []).map(m => m))].filter(n => !caseNames.includes(n));

    // 检测非官方数据源引用
    const suspiciousSourcePattern = /(?:据|来自|根据)[^。]{0,20}(?:某|一家|业内|内部|消息人士)/g;
    const nonCompliantSources: string[] = [...new Set<string>((cleanText.match(suspiciousSourcePattern) || []).map(m => m))];

    // 合规声明检测（文末500字内）
    const lastPart = cleanText.slice(-500);
    const compliancePatterns = /(?:免责声明|风险提示|本文仅供参考|不构成投资建议|请咨询专业人士|具体以实际为准)/;
    const hasComplianceStatement = compliancePatterns.test(lastPart);

    // 数据引用率（数字+数据源关键词的出现频率）
    const dataCitationPattern = /(?:数据|显示|据统计|根据.*报告|%|率)/g;
    const dataCitations = cleanText.match(dataCitationPattern) || [];
    const dataCitationRate = dataCitations.length / Math.max(cleanText.length / 100, 1);

    const summaryParts: string[] = [];
    if (caseNames.length > 0) summaryParts.push(`匿名案例: ${caseNames.join('、')}`);
    if (officialSources.length > 0) summaryParts.push(`官方数据源: ${officialSources.join('、')}`);
    if (nonCompliantCaseNames.length > 0) summaryParts.push(`⚠️ 非规范案例名: ${nonCompliantCaseNames.join('、')}`);
    if (!hasComplianceStatement) summaryParts.push('⚠️ 缺少合规声明');
    if (dataCitationRate < 0.5) summaryParts.push('数据引用偏少');

    return {
      caseNames,
      officialSources,
      hasComplianceStatement,
      nonCompliantCaseNames,
      nonCompliantSources,
      dataCitationRate: Math.round(dataCitationRate * 100) / 100,
      summary: summaryParts.join('；') || '内容细节符合规范',
    };
  }

  /**
   * 维度⑥：排版布局分析（段落级 → analyzeLayout）
   * 检测段落长度分布、小标题模式、总字数、目标合规
   */
  analyzeLayout(text: string, targetWordCount?: number): FormattingStyleAnalysis {
    const cleanText = this.cleanHtml(text);

    // 段落分割（按双换行或HTML段落边界）
    const paragraphs = cleanText
      .split(/\n\s*\n|\n{2,}/)
      .map(p => p.replace(/^\s*[-•·]\s*/, '').trim())
      .filter(p => p.length > 0);

    // 段落长度统计
    const paragraphLengths = paragraphs.map(p => p.length);
    const avgParagraphLength = paragraphLengths.length > 0
      ? Math.round(paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length)
      : 0;
    const shortParagraphRatio = paragraphLengths.length > 0
      ? Math.round((paragraphLengths.filter(l => l <= 50).length / paragraphLengths.length) * 100) / 100
      : 0;
    const longParagraphRatio = paragraphLengths.length > 0
      ? Math.round((paragraphLengths.filter(l => l >= 200).length / paragraphLengths.length) * 100) / 100
      : 0;

    // 小标题检测
    const headingPatterns = [
      /^(?:#{1,3}\s+.+)$/gm,           // Markdown 标题
      /^(?:【.+】)$/gm,                 // 【xxx】格式
      /^(?:\d+[\.、．]\s*.+)$/gm,       // 数字序号
      /^(?:[^\n]{2,20}[:：])/gm,        // 短行冒号结尾
    ];
    const headings: string[] = [];
    for (const pattern of headingPatterns) {
      const matches = cleanText.match(pattern) || [];
      headings.push(...matches.map(h => h.trim()));
    }
    const uniqueHeadings = [...new Set(headings)];
    const headingPattern = uniqueHeadings.length > 3
      ? '结构清晰，多层级标题'
      : uniqueHeadings.length > 1
        ? '有基本分段'
        : '缺少小标题';

    // 句式统计（复用已有方法）
    const sentenceAnalysis = this.analyzeSentencePatterns(cleanText);

    // 总字数（中文字符+英文单词）
    const chineseChars = (cleanText.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (cleanText.match(/[a-zA-Z]+/g) || []).length;
    const totalWordCount = chineseChars + englishWords;

    // 是否符合目标排版
    const compliance = targetWordCount
      ? Math.abs(totalWordCount - targetWordCount) <= targetWordCount * 0.15
      : shortParagraphRatio >= 0.3 && uniqueHeadings.length >= 2;

    const summaryParts: string[] = [];
    summaryParts.push(`总字数: ${totalWordCount}`);
    if (targetWordCount) summaryParts.push(`目标字数: ${targetWordCount}`);
    summaryParts.push(`平均段长: ${avgParagraphLength}字`);
    summaryParts.push(`短段比例: ${(shortParagraphRatio * 100).toFixed(0)}%`);
    summaryParts.push(`小标题: ${uniqueHeadings.length}个 (${headingPattern})`);

    return {
      avgParagraphLength,
      shortParagraphRatio,
      longParagraphRatio,
      headingCount: uniqueHeadings.length,
      headingPattern,
      avgSentenceLength: sentenceAnalysis.avgSentenceLength,
      totalWordCount,
      targetWordCount: targetWordCount || null,
      compliance,
      summary: summaryParts.join('；'),
    };
  }

  /**
   * 🌟 编排器：一次性执行全部 5 维度分析
   * 用于上传文章初始化场景
   * 调用链：analyzeToneProfile(LLM) + analyzeLanguageStyle(NLP) + analyzeVocabulary(NLP) + analyzeContentNorms(NLP) + analyzeLayout(NLP)
   */
  async analyzeSixDimensions(articleText: string, targetWordCount?: number): Promise<SixDimensionAnalysis> {
    console.log('[StyleDeposition] 开始 6 维度分析, 文本长度:', articleText.length);

    // 并行执行所有 NLP 维度（快速）
    const toneAndVoice = this.analyzeLanguageStyle(articleText);
    const expressionHabits = this.analyzeVocabulary(articleText);
    const contentDetails = this.analyzeContentNorms(articleText);
    const formattingStyle = this.analyzeLayout(articleText, targetWordCount);

    // 并行执行 LLM 维度（较慢）
    const [overallTone] = await Promise.all([
      this.analyzeToneProfile(articleText),
    ]);

    console.log('[StyleDeposition] 6 维度分析完成');

    return {
      overallTone,
      toneAndVoice,
      expressionHabits,
      contentDetails,
      formattingStyle,
      articleStructure: null, // 维度③暂不实现
    };
  }

  /**
   * 执行全量重算（定时任务调用）
   *
   * 流程：
   * 1. 查询最近 N 篇已完成的 insurance-d 文章
   * 2. 提取文章纯文本
   * 3. 调用 extractHighFrequencyWords() + analyzeSentencePatterns()
   * 4. 与现有 style_assets 合并去重
   * 5. 过期规则降权
   *
   * @param options - 聚合选项
   * @returns 执行摘要
   */
  async runFullAggregation(options: {
    maxArticles?: number;
    userId?: string;
    expireDays?: number;
  } = {}): Promise<DepositionSummary> {
    const startTime = Date.now();
    const {
      maxArticles = 3,  // 聚合最近 3 篇已完成文章的风格特征（用户可按需调整）
      expireDays = 90,
    } = options;

    const summary: DepositionSummary = {
      processedArticles: 0,
      extractedWords: 0,
      newRulesCreated: 0,
      updatedRules: 0,
      errors: [],
      executionTimeMs: 0,
      skippedByStyleValidation: 0,
      styleWarnings: [],
    };

    try {
      // 1. 查询最近已完成的写作类 Agent 文章（insurance-d + insurance-xiaohongshu）
      // 注意：这里通过 agent_sub_tasks 表查询已完成的写作任务
      // 实际的文章内容存储在 resultData 中
      const completedTasks = await db
        .select({
          id: agentSubTasks.id,
          resultData: agentSubTasks.resultData,
          orderIndex: agentSubTasks.orderIndex,
          updatedAt: agentSubTasks.updatedAt,
          metadata: agentSubTasks.metadata, // 🔥 新增：获取 metadata 以提取 accountId
          fromParentsExecutor: agentSubTasks.fromParentsExecutor,
        })
        .from(agentSubTasks)
        .where(
          and(
            eq(agentSubTasks.status, 'completed'),
            inArray(agentSubTasks.fromParentsExecutor, [...WRITING_AGENTS]),
          )
        )
        .orderBy(desc(agentSubTasks.updatedAt))
        .limit(maxArticles);

      summary.processedArticles = completedTasks.length;
      console.log(`[StyleDeposition] 查询到 ${completedTasks.length} 篇已完成文章`);

      // ═══════════════════════════════════════════════════════════════
      // 🔥 P0 修复：按账号分组，每个账号单独分析
      // ═══════════════════════════════════════════════════════════════
      
      // P1 修复：边界检查
      if (completedTasks.length === 0) {
        console.log('[StyleDeposition] 未查询到已完成的文章');
        summary.executionTimeMs = Date.now() - startTime;
        return summary;
      }

      // 按账号分组
      const tasksByAccount = new Map<string | null, typeof completedTasks>();
      
      for (const task of completedTasks) {
        let accountId: string | null = null;
        if (task.metadata && typeof task.metadata === 'object') {
          const metadata = task.metadata as Record<string, any>;
          accountId = metadata?.accountId || null;
        }
        
        const key = accountId;
        if (!tasksByAccount.has(key)) {
          tasksByAccount.set(key, []);
        }
        tasksByAccount.get(key)!.push(task);
      }

      console.log(`[StyleDeposition] 按账号分组: ${tasksByAccount.size} 个分组`);
      for (const [accId, tasks] of tasksByAccount) {
        console.log(`[StyleDeposition] - ${accId || '无账号'}: ${tasks.length} 篇文章`);
      }

      // P1 修复：统一导入，避免重复动态导入
      const { styleTemplateService } = await import('./style-template-service');
      
      // 🔥 风格相似度校验：导入校验服务
      const { styleSimilarityValidator } = await import('./style-similarity-validator');

      // 每个账号单独分析并保存
      for (const [accountId, tasks] of tasksByAccount) {
        // 获取该账号的模板ID
        let templateId: string | undefined = undefined;
        
        if (accountId) {
          try {
            templateId = await styleTemplateService.getTemplateIdByAccount(accountId);
            if (templateId) {
              console.log(`[StyleDeposition] 账号 ${accountId} 绑定的模板ID: ${templateId}`);
            } else {
              console.warn(`[StyleDeposition] 账号 ${accountId} 未绑定风格模板`);
            }
          } catch (e) {
            console.warn(`[StyleDeposition] 获取账号模板失败:`, e);
          }
        }

        // 如果没有账号或账号未绑定模板，使用默认模板
        if (!templateId) {
          try {
            const defaultTemplate = await styleTemplateService.getDefaultTemplate(options.userId || 'default-user');
            if (defaultTemplate) {
              templateId = defaultTemplate.id;
              console.log(`[StyleDeposition] 使用默认模板: ${defaultTemplate.name} (${templateId})`);
            }
          } catch (e) {
            console.warn(`[StyleDeposition] 获取默认模板失败:`, e);
          }
        }

        // 提取该账号的文章文本
        const articleTexts: string[] = [];
        for (const task of tasks) {
          try {
            const text = this.extractArticleTextFromResultData(task.resultData);
            if (text && text.length > 100) {
              articleTexts.push(text);
            }
          } catch (e) {
            summary.errors.push(`提取文章文本失败(task=${task.id}): ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        if (articleTexts.length === 0) {
          console.warn(`[StyleDeposition] 账号 ${accountId || '无账号'} 无有效文章文本`);
          continue;
        }

        console.log(`[StyleDeposition] 分析账号 ${accountId || '无账号'} 的 ${articleTexts.length} 篇文章`);

        // ═══════════════════════════════════════════════════════════════
        // 🔥 风格相似度校验（优化：先校验过滤，再分析，避免重复分析）
        // 在保存规则之前，校验文章风格是否与模板匹配
        // 防止风格污染：避免将不匹配的风格规则保存到模板中
        // ═══════════════════════════════════════════════════════════════
        
        // 只有当模板有足够规则时才进行校验
        if (templateId) {
          try {
            // 缓存每篇文章的分析结果，避免重复分析
            const articleStyleCache = new Map<string, SixDimensionAnalysis>();
            
            // 对每篇文章进行风格分析
            for (let i = 0; i < articleTexts.length; i++) {
              const articleText = articleTexts[i];
              
              // 分析文章风格并缓存
              let articleStyle = articleStyleCache.get(articleText);
              if (!articleStyle) {
                articleStyle = await this.analyzeSixDimensions(articleText);
                articleStyleCache.set(articleText, articleStyle);
              }
              
              const validation = await styleSimilarityValidator.validate(
                articleStyle,
                templateId,
                options.userId
              );
              
              console.log(`[StyleDeposition] 风格相似度校验: 账号=${accountId || '无账号'}, 相似度=${(validation.similarity * 100).toFixed(1)}%, 允许保存=${validation.canSave}`);
              
              // 校验不通过，跳过该文章
              if (!validation.canSave) {
                summary.skippedByStyleValidation = (summary.skippedByStyleValidation || 0) + 1;
                const warning = `账号 ${accountId || '无账号'} 文章 ${i + 1} 风格相似度过低 (${(validation.similarity * 100).toFixed(0)}%)，已跳过`;
                summary.styleWarnings = summary.styleWarnings || [];
                summary.styleWarnings.push(warning);
                console.warn(`[StyleDeposition] ${warning}`);
                
                // 从 articleTexts 中移除该文章
                articleTexts.splice(i, 1);
                i--; // 调整索引
              } else if (validation.warning) {
                // 校验通过但有警告
                summary.styleWarnings = summary.styleWarnings || [];
                summary.styleWarnings.push(`账号 ${accountId || '无账号'} 文章 ${i + 1}: ${validation.warning}`);
              }
            }
            
            // 如果所有文章都被跳过，跳过该账号
            if (articleTexts.length === 0) {
              console.warn(`[StyleDeposition] 账号 ${accountId || '无账号'} 所有文章均被风格相似度校验跳过`);
              continue;
            }
            
          } catch (validationError) {
            // 校验失败不阻塞流程，记录警告
            console.error(`[StyleDeposition] 风格相似度校验异常:`, validationError);
            summary.styleWarnings = summary.styleWarnings || [];
            summary.styleWarnings.push(`账号 ${accountId || '无账号'} 风格校验异常: ${validationError instanceof Error ? validationError.message : String(validationError)}`);
          }
        }

        // 分析该账号的文章（校验过滤后再分析，避免重复分析）
        const accountResults = await this.analyzeArticlesForAccount(articleTexts);
        
        if (accountResults.length === 0) {
          continue;
        }

        // 保存到对应模板
        try {
          const saveResult = await this.saveDepositionResults(accountResults, options.userId, templateId);
          summary.newRulesCreated += saveResult.created;
          summary.updatedRules += saveResult.updated;
          console.log(`[StyleDeposition] 账号 ${accountId || '无账号'} 保存规则: 新建 ${saveResult.created}, 更新 ${saveResult.updated}`);
        } catch (e) {
          summary.errors.push(`账号 ${accountId || '无账号'} 保存规则失败: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      summary.executionTimeMs = Date.now() - startTime;
      return summary;
    } catch (error) {
      summary.errors.push(`全量聚合异常: ${error instanceof Error ? error.message : String(error)}`);
      console.error('[StyleDeposition] 全量聚合失败:', error);
      summary.executionTimeMs = Date.now() - startTime;
      return summary;
    }
  }

  /**
   * 从 resultData 中提取文章纯文本
   */
  private extractArticleTextFromResultData(resultData: any): string | null {
    if (!resultData) return null;

    try {
      const data = typeof resultData === 'string' ? JSON.parse(resultData) : resultData;

      // 尝试多种可能的字段路径
      const possiblePaths = [
        data?.articleContent,
        data?.content,
        data?.executorOutput?.output,
        data?.executorOutput?.result,
        data?.output,
        data?.title ? `${data.title}\n${data.content || data.articleContent || ''}` : null,
      ];

      for (const text of possiblePaths) {
        if (typeof text === 'string' && text.trim().length > 50) {
          // 清理 HTML 标签
          return text.replace(/<[^>]+>/g, '').trim();
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * 🔥 P0 修复：分析单账号的文章，返回风格规则
   * 
   * 将原有的分析逻辑抽取为独立方法，支持按账号分组调用
   */
  private async analyzeArticlesForAccount(articleTexts: string[]): Promise<StyleDepositionResult[]> {
    if (articleTexts.length === 0) {
      return [];
    }

    // 合并所有文章文本用于分析
    const combinedText = articleTexts.join('\n\n');

    // 1. 提取高频词
    const wordResults = await this.extractHighFrequencyWords(combinedText);

    // 2. 分析句式模式
    const patternRules = this.analyzeSentencePatterns(combinedText);

    // 3. 🔥 新增：提取6维度风格特征（复用 analyzeSixDimensions）
    let dimensionResults: StyleDepositionResult[] = [];
    try {
      const sixDimensions = await this.analyzeSixDimensions(combinedText);
      dimensionResults = this.convertDimensionsToRules(sixDimensions);
    } catch (e) {
      console.warn('[StyleDeposition] 6维度分析失败:', e);
    }

    // 合并所有结果
    return [...wordResults, ...patternRules, ...dimensionResults];
  }

  /**
   * 将6维度分析结果转换为风格规则格式
   */
  private convertDimensionsToRules(analysis: any): StyleDepositionResult[] {
    const results: StyleDepositionResult[] = [];

    // 整体调性
    if (analysis.overallTone?.overallTone) {
      results.push({
        ruleType: 'emotion',
        ruleContent: analysis.overallTone.overallTone,
        sampleExtract: analysis.overallTone.summary || '',
        priority: 3,
        source: 'auto_deposition',
      });
    }

    // 语气与声音
    if (analysis.toneAndVoice?.summary) {
      results.push({
        ruleType: 'tone',
        ruleContent: analysis.toneAndVoice.summary,
        sampleExtract: `口语化程度: ${analysis.toneAndVoice.colloquialismScore || 0}`,
        priority: 2,
        source: 'auto_deposition',
      });
    }

    // 表达习惯
    if (analysis.expressionHabits?.summary) {
      results.push({
        ruleType: 'vocabulary',
        ruleContent: analysis.expressionHabits.summary,
        sampleExtract: analysis.expressionHabits.highFrequencyWords?.slice(0, 5).map((w: any) => w.word).join(', ') || '',
        priority: 2,
        source: 'auto_deposition',
      });
    }

    // 禁用词补充
    if (analysis.expressionHabits?.forbiddenWords?.length > 0) {
      const forbiddenPatterns = analysis.expressionHabits.forbiddenWords.map((w: any) => w.pattern || w.word).filter(Boolean);
      if (forbiddenPatterns.length > 0) {
        results.push({
          ruleType: 'forbidden_supplement',
          ruleContent: `避免使用: ${forbiddenPatterns.join('、')}`,
          sampleExtract: '',
          priority: 4,
          source: 'auto_deposition',
        });
      }
    }

    return results;
  }

  // ================================================================
  // 工具方法
  // ================================================================

  /**
   * 按中英文标点分割句子
   */
  private splitSentences(text: string): string[] {
    return text
      .replace(/<[^>]+>/g, '') // 去除HTML标签
      .split(/(?<=[。！？.!?])/g)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
}

// ========== 导出单例实例 ==========
export const styleDepositionService = StyleDepositionService.getInstance();
