/**
 * 小红书风格分析器
 *
 * 从标杆小红书笔记中提取风格规则，用于 insurance-d 生成时复用
 *
 * 分析维度（7维）：
 * 1. title_pattern - 标题套路（悬念式、揭秘式、数字式、反差式、情感共鸣式）
 * 2. emoji_usage - emoji 使用习惯（密度、位置、类型偏好）
 * 3. visual_layout - 文字排版（段落长度、换行频率、要点数量）
 * 4. tone - 语气基调（亲切、专业、警示、共情）
 * 5. vocabulary - 高频词、禁用词、口头禅
 * 6. card_style - 卡片视觉风格（配色倾向、装饰风格）
 * 7. image_structure - 图文结构（NEW! 图片数量模式、图文分工、卡片简洁度）
 *
 * 数据流向：
 *   小红书笔记文本 → analyzeXiaohongshuStyle() → StyleRuleInsert[] → 写入 style_assets
 */

import type { NewStyleAsset } from '@/lib/db/schema/digital-assets';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { createUserLLMClient } from '@/lib/llm/factory';

// 从共享类型文件 re-export，避免前端直接导入此文件拉入 coze-coding-dev-sdk
export type { XiaohongshuStyleAnalysis } from '@/types/style-analysis';
import type { XiaohongshuStyleAnalysis } from '@/types/style-analysis';

// ========== 类型定义 ==========

/** 小红书笔记结构 */
export interface XiaohongshuNote {
  title: string;           // 标题
  content: string;         // 正文文字（含emoji）
  images?: string[];       // 图片URL列表
  tags?: string[];         // 话题标签
  likes?: number;          // 点赞数（用于评估质量）
  author?: string;         // 作者名
}

/** 小红书风格分析结果 */
/** 风格规则条目（可直接写入 style_assets） */
export interface XiaohongshuStyleRule {
  ruleType: 'title_pattern' | 'emoji_usage' | 'visual_layout' | 'tone' | 'vocabulary' | 'card_style' | 'image_structure' | 'color_scheme';
  ruleContent: string;
  ruleCategory: 'positive' | 'negative';
  confidence: number;
  sampleExtract?: string;
  metadata?: Record<string, unknown>;
}

// ========== 核心分析函数 ==========

/**
 * 分析单篇小红书笔记的风格
 *
 * @param note 小红书笔记内容
 * @param options 可选配置
 *   - preferredImageMode: 用户指定的图片数量模式（3-card/5-card/7-card）
 */
export async function analyzeXiaohongshuNote(
  note: XiaohongshuNote,
  options?: { preferredImageMode?: '3-card' | '5-card' | '7-card'; workspaceId?: string }
): Promise<XiaohongshuStyleAnalysis> {
  // BYOK: 优先使用用户 Key
  const { client: llmClient } = await createUserLLMClient(options?.workspaceId);

  let prompt = `请分析以下小红书笔记的风格特征，输出JSON格式：

【标题】${note.title}

【正文】
${note.content}

【话题标签】${note.tags?.join(', ') || '无'}

请从以下 7 个维度分析（重点！第7维是核心）：
1. 标题套路：是悬念式？揭秘式？数字式？反差式？还是情感共鸣式？
2. emoji使用：密度高/中/低？常用哪些emoji？位置在哪？
3. 排版风格：段落长短？换行频率？用编号分点吗？
4. 语气基调：亲切？专业？警示？共情？
5. 高频词汇：有哪些重复出现的词或口头禅？
6. 卡片视觉风格：配色倾向（暖色/冷色/中性）？装饰风格（极简/优雅/活泼/专业）？
7. ★ 图文结构（最关键）：这篇笔记如果做成图片卡片，应该怎么分配内容到图片和文字区？
   - 图片数量适合3张、5张还是7张？（3张=极简要点，5张=标准，7张=详细展开）
   - 每张图片上放多少文字？（极简=仅标题，简洁=标题+1行，标准=标题+2-3行）
   - 哪些内容只放图片上？（核心结论、金句、高冲击力信息）
   - 哪些内容只放文字区？（数据支撑、详细案例、论证过程）
   - 请逐张描述每张图卡片的架构（类型+主文案+作用）

输出JSON格式：
{
  "titlePattern": { "type": "suspense|revelation|numbered|contrast|emotional", "pattern": "描述", "confidence": 0.9 },
  "emojiUsage": { "density": "low|medium|high", "commonEmojis": ["😊"], "positionPattern": "描述", "confidence": 0.85 },
  "visualLayout": { "paragraphStyle": "short|medium|long", "lineBreakFrequency": "high|medium|low", "bulletPointStyle": "numbered|dotted|emoji|none", "avgParagraphLength": 15, "pointCount": 5, "confidence": 0.9 },
  "tone": { "primary": "empathetic|professional|warning|warm|casual", "description": "描述", "confidence": 0.88 },
  "vocabulary": { "highFrequencyWords": [{"word": "词", "count": 3}], "catchphrases": ["短语"], "transitionWords": ["但是"], "confidence": 0.85 },
  "cardStyle": { "colorScheme": "warm|cool|neutral|vibrant", "decorationStyle": "minimal|elegant|playful|professional", "fontStyle": "bold|light|cute|formal", "confidence": 0.8 },
  "imageStructure": {
    "imageCountMode": "3-card|5-card|7-card",
    "cardTextDensity": "minimal|concise|standard",
    "contentDistribution": {
      "imageOnlyPoints": ["图片上展示的核心结论1", "核心结论2"],
      "textOnlyDetails": ["文字区展开的详细论证1"],
      "bothSummary": ["两处都有的总结"]
    },
    "cardArchitecture": [
      { "cardIndex": 1, "cardType": "cover", "headline": "封面标题文案", "purpose": "吸引点击" },
      { "cardIndex": 2, "cardType": "key-point", "headline": "要点1的结论性文案", "purpose": "传递核心信息" }
    ],
    "confidence": 0.9
  }
}`;

  // P0修复：如果用户指定了图片模式，在 Prompt 中追加约束
  if (options?.preferredImageMode) {
    const modeLabels: Record<string, { label: string; cardCount: number; density: string }> = {
      '3-card': { label: '3张极简', cardCount: 1, density: '仅标题（≤20字大字号）' },
      '5-card': { label: '5张标准', cardCount: 3, density: '标题+1行内容（≤50字）' },
      '7-card': { label: '7张详细', cardCount: 5, density: '标题+2-3行完整内容（≤100字）' },
    };
    const modeInfo = modeLabels[options.preferredImageMode];
    if (modeInfo) {
      prompt += `\n\n【重要约束】用户已指定图片数量模式为「${modeInfo.label}」。
请严格按此模式生成：
- 图片总数：封面 + ${modeInfo.cardCount}个要点 + 结尾 = ${modeInfo.cardCount + 2} 张
- 每张要点卡的文字密度：${modeInfo.density}
- cardArchitecture 必须包含 ${modeInfo.cardCount + 2} 个元素（1 cover + ${modeInfo.cardCount} key-point/detail + 1 ending）
- contentDistribution 必须按「图片放核心结论，文字区放详细论证」的原则分配`;
    }
  }

  try {
    const response = await llmClient.invoke(
      [{ role: 'user', content: prompt }],
      {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.3,
      }
    );

    // 安全解析 LLM 输出的 JSON（处理 markdown 代码块包裹、前后说明文字等）
    const result = safeParseLLMJSON<XiaohongshuStyleAnalysis>(response.content);
    return result;
  } catch (error) {
    console.error('[XHS Style Analyzer] LLM analysis failed:', error);
    // 返回默认值（传入用户指定的图片模式）
    return getDefaultAnalysis(options?.preferredImageMode);
  }
}

/**
 * 将分析结果转换为 style_assets 规则条目
 */
export function convertAnalysisToRules(
  analysis: XiaohongshuStyleAnalysis,
  templateId: string,
  workspaceId: string
): NewStyleAsset[] {
  const rules: NewStyleAsset[] = [];
  const now = new Date();

  // 安全取数组字段，防止 LLM 返回缺失导致 .join() 崩溃
  const safeArr = (v: unknown): string[] => Array.isArray(v) ? v : [];
  const safeNum = (v: unknown, fallback = 0): number => typeof v === 'number' ? v : fallback;

  // 1. 标题套路规则
  if (analysis.titlePattern) {
    rules.push({
      id: crypto.randomUUID(),
      ruleType: 'title_pattern',
      ruleContent: `标题套路：${analysis.titlePattern.pattern ?? '未知'}`,
      ruleCategory: 'positive',
      confidence: String(analysis.titlePattern.confidence ?? 0.5),
      priority: 2,
      sourceType: 'llm_assist',
      sampleExtract: safeArr(analysis.titlePattern.examples).join('\n'),
      templateId,
      workspaceId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      validityExpiresAt: null,
    });
  }

  // 2. emoji 使用规则
  if (analysis.emojiUsage) {
    const emojis = safeArr(analysis.emojiUsage.commonEmojis);
    rules.push({
      id: crypto.randomUUID(),
      ruleType: 'emoji_usage',
      ruleContent: `emoji使用：密度${analysis.emojiUsage.density ?? 'medium'}，常用${emojis.slice(0, 5).join('')}，位置习惯：${analysis.emojiUsage.positionPattern ?? '未知'}`,
      ruleCategory: 'positive',
      confidence: String(analysis.emojiUsage.confidence ?? 0.5),
      priority: 3,
      sourceType: 'llm_assist',
      sampleExtract: emojis.join(' '),
      templateId,
      workspaceId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      validityExpiresAt: null,
    });
  }

  // 3. 图文排版规则
  if (analysis.visualLayout) {
    rules.push({
      id: crypto.randomUUID(),
      ruleType: 'visual_layout',
      ruleContent: `排版风格：${analysis.visualLayout.paragraphStyle ?? 'short'}段落，换行${analysis.visualLayout.lineBreakFrequency ?? 'medium'}，分点方式：${analysis.visualLayout.bulletPointStyle ?? 'none'}，要点数量：${safeNum(analysis.visualLayout.pointCount)}个`,
      ruleCategory: 'positive',
      confidence: String(analysis.visualLayout.confidence ?? 0.5),
      priority: 2,
      sourceType: 'llm_assist',
      sampleExtract: `平均段落${safeNum(analysis.visualLayout.avgParagraphLength)}字`,
      templateId,
      workspaceId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      validityExpiresAt: null,
    });
  }

  // 4. 语气基调规则
  if (analysis.tone) {
    rules.push({
      id: crypto.randomUUID(),
      ruleType: 'tone',
      ruleContent: `语气基调：${analysis.tone.primary ?? 'casual'}，${analysis.tone.description ?? ''}`,
      ruleCategory: 'positive',
      confidence: String(analysis.tone.confidence ?? 0.5),
      priority: 1,
      sourceType: 'llm_assist',
      sampleExtract: analysis.tone.description ?? '',
      templateId,
      workspaceId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      validityExpiresAt: null,
    });
  }

  // 5. 词汇习惯规则
  if (analysis.vocabulary) {
    const hfw = safeArr(analysis.vocabulary.highFrequencyWords);
    const cp = safeArr(analysis.vocabulary.catchphrases);
    const tw = safeArr(analysis.vocabulary.transitionWords);
    if (hfw.length > 0 || cp.length > 0) {
      rules.push({
        id: crypto.randomUUID(),
        ruleType: 'vocabulary',
        ruleContent: `高频词汇：${hfw.slice(0, 5).map((w: any) => w?.word ?? w).join('、')}；口头禅：${cp.slice(0, 3).join('、')}`,
        ruleCategory: 'positive',
        confidence: String(analysis.vocabulary.confidence ?? 0.5),
        priority: 3,
        sourceType: 'llm_assist',
        sampleExtract: hfw.map((w: any) => `${w?.word ?? w}(${w?.count ?? 0}次)`).join(', '),
        templateId,
        workspaceId,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        validityExpiresAt: null,
      });
    }
  }

  // 6. 卡片风格规则（如果有图片分析）
  if (analysis.cardStyle) {
    rules.push({
      id: crypto.randomUUID(),
      ruleType: 'card_style',
      ruleContent: `卡片风格：${analysis.cardStyle.colorScheme ?? 'warm'}配色，${analysis.cardStyle.decorationStyle ?? 'minimal'}装饰，${analysis.cardStyle.fontStyle ?? 'bold'}字体`,
      ruleCategory: 'positive',
      confidence: String(analysis.cardStyle.confidence ?? 0.5),
      priority: 2,
      sourceType: 'llm_assist',
      sampleExtract: '',
      templateId,
      workspaceId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      validityExpiresAt: null,
    });
  }

  // 7. 图文结构规则（核心维度）
  if (analysis.imageStructure) {
    const is = analysis.imageStructure;
    const modeLabel = is.imageCountMode === '3-card' ? '3张极简' :
                       is.imageCountMode === '5-card' ? '5张标准' : '7张详细';
    const densityLabel = is.cardTextDensity === 'minimal' ? '仅标题' :
                         is.cardTextDensity === 'concise' ? '标题+1行' : '标题+2-3行';
    const cardArch = safeArr(is.cardArchitecture);
    const imgOnly = safeArr(is.contentDistribution?.imageOnlyPoints);
    const txtOnly = safeArr(is.contentDistribution?.textOnlyDetails);

    // 规则7a：图片数量模式
    rules.push({
      id: crypto.randomUUID(),
      ruleType: 'image_structure',
      ruleContent: `图片模式：${modeLabel}，卡片文字密度：${densityLabel}`,
      ruleCategory: 'positive',
      confidence: String(is.confidence ?? 0.5),
      priority: 1,
      sourceType: 'llm_assist',
      sampleExtract: cardArch.map((c: any) => `[${c?.cardType ?? '?'}] ${c?.headline ?? ''}`).join('\n'),
      templateId,
      workspaceId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      validityExpiresAt: null,
    });

    // 规则7b：图文分工原则
    if (imgOnly.length > 0) {
      rules.push({
        id: crypto.randomUUID(),
        ruleType: 'image_structure',
        ruleContent: `图文分工-图片专属：${imgOnly.join('；')}`,
        ruleCategory: 'positive',
        confidence: String(is.confidence ?? 0.5),
        priority: 1,
        sourceType: 'llm_assist',
        sampleExtract: '',
        templateId,
        workspaceId,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        validityExpiresAt: null,
      });
    }

    // 规则7c：文字区展开原则
    if (txtOnly.length > 0) {
      rules.push({
        id: crypto.randomUUID(),
        ruleType: 'image_structure',
        ruleContent: `图文分工-文字专属：${txtOnly.join('；')}`,
        ruleCategory: 'positive',
        confidence: String(is.confidence ?? 0.5),
        priority: 2,
        sourceType: 'llm_assist',
        sampleExtract: '',
        templateId,
        workspaceId,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        validityExpiresAt: null,
      });
    }
  }

  // 8. 精确配色方案规则（多模态图片分析结果）
  if (analysis.visualStyle) {
    const vs = analysis.visualStyle;
    const cs = vs.colorScheme;

    rules.push({
      id: crypto.randomUUID(),
      ruleType: 'color_scheme',
      ruleContent: `配色方案：主色${cs?.primaryColor ?? '?'}+辅色${cs?.secondaryColor ?? '?'}，背景${cs?.backgroundColor ?? '?'}，强调色${cs?.accentColor ?? '?'}，文字主色${cs?.textPrimaryColor ?? '?'}，文字副色${cs?.textSecondaryColor ?? '?'}，色调${cs?.tone ?? '?'}`,
      ruleCategory: 'positive',
      confidence: String(cs?.confidence ?? 0.5),
      priority: 1,
      sourceType: 'multimodal',
      sampleExtract: `${cs?.primaryColor ?? '?'}→${cs?.secondaryColor ?? '?'}`,
      templateId,
      workspaceId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      validityExpiresAt: null,
    });
  }

  return rules;
}

/**
 * 批量分析多篇小红书笔记，聚合风格规则
 */
export async function analyzeXiaohongshuNotesBatch(
  notes: XiaohongshuNote[],
  templateId: string,
  workspaceId: string
): Promise<{ rules: NewStyleAsset[]; summary: { totalNotes: number; successCount: number; failedCount: number } }> {
  const allRules: NewStyleAsset[] = [];
  let successCount = 0;
  let failedCount = 0;

  // 并行分析所有笔记（比串行快 N 倍）
  const results = await Promise.allSettled(
    notes.map(note => analyzeXiaohongshuNote(note))
  );

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const rules = convertAnalysisToRules(result.value, templateId, workspaceId);
      allRules.push(...rules);
      successCount++;
    } else {
      console.error('[XHS Style Analyzer] Failed to analyze note:', notes[index].title, result.reason);
      failedCount++;
    }
  });

  // 去重：相同 ruleType + ruleContent 的规则合并
  const uniqueRules = mergeDuplicateRules(allRules);

  return {
    rules: uniqueRules,
    summary: {
      totalNotes: notes.length,
      successCount,
      failedCount,
    },
  };
}

/**
 * 合并重复规则（相同类型和内容）
 */
function mergeDuplicateRules(rules: NewStyleAsset[]): NewStyleAsset[] {
  const map = new Map<string, NewStyleAsset>();

  for (const rule of rules) {
    const key = `${rule.ruleType}:${rule.ruleContent}`;
    if (map.has(key)) {
      // 合并：取更高置信度
      const existing = map.get(key)!;
      const existingConf = parseFloat(existing.confidence as string);
      const newConf = parseFloat(rule.confidence as string);
      if (newConf > existingConf) {
        map.set(key, rule);
      }
    } else {
      map.set(key, rule);
    }
  }

  return Array.from(map.values());
}

/**
 * 默认分析结果（LLM失败时使用）
 */
function getDefaultAnalysis(preferredImageMode?: '3-card' | '5-card' | '7-card'): XiaohongshuStyleAnalysis {
  const mode = preferredImageMode || '5-card';
  return {
    titlePattern: {
      type: 'suspense',
      pattern: '悬念揭秘式：先否定/放弃，再揭示真相',
      examples: ['我已经不卖重疾险了，但我能告诉你一些真相'],
      confidence: 0.7,
    },
    emojiUsage: {
      density: 'medium',
      commonEmojis: ['✅', '❌', '⚠️', '💡', '🔥'],
      positionPattern: '段落开头或独立成行',
      confidence: 0.7,
    },
    visualLayout: {
      paragraphStyle: 'short',
      lineBreakFrequency: 'high',
      bulletPointStyle: 'numbered',
      avgParagraphLength: 15,
      pointCount: mode === '3-card' ? 1 : mode === '5-card' ? 3 : 5,
      confidence: 0.75,
    },
    tone: {
      primary: 'empathetic',
      description: '亲切、像朋友聊天、大白话',
      confidence: 0.75,
    },
    vocabulary: {
      highFrequencyWords: [],
      catchphrases: ['说实话', '说白了', '其实'],
      transitionWords: ['但是', '所以', '而且'],
      confidence: 0.7,
    },
    cardStyle: {
      colorScheme: 'warm',
      decorationStyle: 'minimal',
      fontStyle: 'bold',
      confidence: 0.6,
    },
    imageStructure: {
      imageCountMode: mode,
      cardTextDensity: mode === '3-card' ? 'minimal' : mode === '5-card' ? 'concise' : 'standard',
      contentDistribution: {
        imageOnlyPoints: ['核心结论先行', '关键数据/数字'],
        textOnlyDetails: ['详细论证过程', '案例故事', '专业术语解释'],
        bothSummary: ['总括性总结'],
      },
      cardArchitecture: [
        { cardIndex: 1, cardType: 'cover', headline: '封面标题（悬念/反差）', purpose: '吸引点击' },
        { cardIndex: 2, cardType: 'key-point', headline: '要点1结论（≤15字）', purpose: '传递核心信息' },
        { cardIndex: 3, cardType: 'key-point', headline: '要点2结论（≤15字）', purpose: '传递核心信息' },
        { cardIndex: 4, cardType: 'key-point', headline: '要点3结论（≤15字）', purpose: '传递核心信息' },
        { cardIndex: 5, cardType: 'key-point', headline: '要点4结论（≤15字）', purpose: '传递核心信息' },
        { cardIndex: 6, cardType: 'detail', headline: '要点5展开（≤30字）', purpose: '补充细节' },
        { cardIndex: 7, cardType: 'ending', headline: '总结+行动召唤', purpose: '引导关注/互动' },
      ],
      confidence: 0.65,
    },
    // 🔥 默认视觉风格（暖色极简，未上传图片时使用）
    visualStyle: {
      colorScheme: {
        primaryColor: '#FF6B6B',
        secondaryColor: '#FF8E53',
        backgroundColor: '#FFF5F5',
        accentColor: '#FF4757',
        textPrimaryColor: '#FFFFFF',
        textSecondaryColor: '#FFE0E0',
        tone: 'warm',
        confidence: 0.5,
      },
      layout: {
        contentTopRatio: 0.15,
        contentSideRatio: 0.08,
        titleAlignment: 'center',
        hasBottomDecoration: false,
        confidence: 0.5,
      },
      font: {
        titleSize: 'large',
        titleWeight: 'bold',
        bodySize: 'medium',
        style: 'bold',
        confidence: 0.5,
      },
      decoration: {
        hasDivider: false,
        dividerStyle: 'none',
        hasBadge: false,
        borderRadius: 'medium',
        hasShadow: true,
        style: 'minimal',
        confidence: 0.5,
      },
      source: 'default',
    },
  };
}

// ========== LLM JSON 安全解析工具 ==========

/**
 * 安全解析 LLM 输出的 JSON
 *
 * 处理以下异常情况：
 * 1. Markdown 代码块包裹：```json {...} ```
 * 2. 前后带说明文字："以下是分析结果：{...}"
 * 3. 格式错误的 JSON（尝试修复常见问题）
 * 4. 降级兜底：解析失败返回 null（调用方应处理）
 */
function safeParseLLMJSON<T>(raw: string): T {
  let text = raw.trim();

  // 1. 移除 markdown 代码块包裹
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  }

  // 2. 尝试提取 JSON 对象（找到最外层 { ... }）
  const braceStart = text.indexOf('{');
  const braceEnd = text.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
    text = text.slice(braceStart, braceEnd + 1);
  }

  // 3. 尝试直接解析
  try {
    return JSON.parse(text) as T;
  } catch {
    // 继续尝试修复
  }

  // 4. 常见修复：单引号 → 双引号
  try {
    const fixed = text.replace(/'/g, '"');
    return JSON.parse(fixed) as T;
  } catch {
    // 继续尝试
  }

  // 5. 常见修复：尾逗号移除
  try {
    const fixed = text.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(fixed) as T;
  } catch {
    // 所有尝试失败
  }

  console.warn('[XHS Style Analyzer] safeParseLLMJSON: 无法解析JSON，原始长度:', raw.length);
  throw new Error(`Failed to parse LLM JSON output. Raw length: ${raw.length}`);
}

// ========== 辅助函数 ==========

/**
 * 从文本中提取emoji
 */
export function extractEmojis(text: string): string[] {
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}]|[\u{2B06}-\u{2B07}]|[\u{2B05}-\u{2B07}]|[\u{2194}-\u{2199}]|[\u{2194}-\u{2199}]|[\u{21A9}-\u{21AA}]|[\u{2934}-\u{2935}]|[\u{25AA}-\u{25AB}]|[\u{25FB}-\u{25FE}]|[\u{25FD}-\u{25FE}]|[\u{2B1B}-\u{2B1C}]|[\u{1F004}]|[\u{1F0CF}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]|[\u{24C2}]|[\u{1F170}-\u{1F251}]|[\u{1F600}-\u{1F636}]|[\u{1F681}-\u{1F6C5}]|[\u{1F30D}-\u{1F567}]/gu;
  const matches = text.match(emojiRegex);
  return matches ? [...new Set(matches)] : [];
}

/**
 * 计算emoji密度
 */
export function calculateEmojiDensity(text: string): number {
  const emojis = extractEmojis(text);
  const totalChars = text.length;
  return totalChars > 0 ? (emojis.length / totalChars) * 100 : 0;
}

/**
 * 分析段落结构
 */
export function analyzeParagraphs(text: string): {
  count: number;
  avgLength: number;
  lengths: number[];
} {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  const lengths = paragraphs.map(p => p.trim().length);
  const avgLength = lengths.length > 0 ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;

  return {
    count: paragraphs.length,
    avgLength: Math.round(avgLength),
    lengths,
  };
}

/**
 * 识别标题套路
 */
export function detectTitlePattern(title: string): XiaohongshuStyleAnalysis['titlePattern'] {
  const patterns = [
    { type: 'suspense' as const, regex: /真相|秘密|揭秘|内幕|不为人知|原来/i, desc: '悬念揭秘式' },
    { type: 'numbered' as const, regex: /\d+个|\d+点|\d+招|\d+条|\d+分钟|\d+秒/i, desc: '数字清单式' },
    { type: 'contrast' as const, regex: /不.*了|但是|却|其实/i, desc: '反差对比式' },
    { type: 'emotional' as const, regex: /哭了|破防|后悔|后悔|一定|必须/i, desc: '情感共鸣式' },
    { type: 'question' as const, regex: /\?|？|怎么办|为什么|如何/i, desc: '疑问引导式' },
  ];

  for (const p of patterns) {
    if (p.regex.test(title)) {
      return {
        type: p.type,
        pattern: p.desc,
        examples: [title],
        confidence: 0.85,
      };
    }
  }

  return {
    type: 'story',
    pattern: '故事分享式',
    examples: [title],
    confidence: 0.7,
  };
}
