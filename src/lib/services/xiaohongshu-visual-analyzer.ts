/**
 * 小红书笔记截图 — 多模态视觉风格分析器
 *
 * 用户上传 1-9 张小红书笔记截图，通过多模态 LLM 提取：
 * - 配色方案（主色/辅色/背景色/强调色，精确 HEX 值）
 * - 视觉布局（卡片边距/文字位置/装饰元素位置）
 * - 字体风格（字号/粗细/风格倾向）
 * - 装饰元素（分割线/标签角标/圆角/阴影）
 *
 * 成本：约 ¥0.02-0.05/次（一次性），后续使用零成本
 */

import { LLMClient, Config, type Message, type ContentPart } from 'coze-coding-dev-sdk';
import { createUserLLMClient } from '@/lib/llm/factory';

// ═══════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════

/** 配色方案（精确到 HEX 值，Canvas 可直接使用） */
export interface ColorScheme {
  /** 主色（渐变起始色/大面积色块） */
  primaryColor: string;        // e.g. '#FF6B6B'
  /** 辅助色（渐变终止色/次要色块） */
  secondaryColor: string;      // e.g. '#FF8E53'
  /** 背景色（卡片底色） */
  backgroundColor: string;     // e.g. '#FFF5F5'
  /** 强调色（数字/标签/CTA） */
  accentColor: string;         // e.g. '#FF4757'
  /** 文字主色（标题） */
  textPrimaryColor: string;    // e.g. '#FFFFFF'
  /** 文字副色（正文/说明） */
  textSecondaryColor: string;  // e.g. '#FFE0E0'
  /** 整体色调倾向 */
  tone: 'warm' | 'cool' | 'neutral' | 'vibrant';
  /** 置信度 */
  confidence: number;
}

/** 视觉布局 */
export interface VisualLayout {
  /** 内容区上边距比例 (0-1) */
  contentTopRatio: number;     // e.g. 0.15 = 顶部留15%
  /** 内容区左右边距比例 (0-1) */
  contentSideRatio: number;    // e.g. 0.08 = 左右留8%
  /** 标题居中方式 */
  titleAlignment: 'center' | 'left' | 'right';
  /** 是否有底部装饰区域 */
  hasBottomDecoration: boolean;
  /** 置信度 */
  confidence: number;
}

/** 字体风格 */
export interface FontProfile {
  /** 标题字号级别 */
  titleSize: 'large' | 'medium' | 'small';   // 大/中/小
  /** 标题粗细 */
  titleWeight: 'bold' | 'semibold' | 'regular';
  /** 正文字号级别 */
  bodySize: 'large' | 'medium' | 'small';
  /** 整体字体风格 */
  style: 'bold' | 'light' | 'cute' | 'formal' | 'handwritten';
  /** 置信度 */
  confidence: number;
}

/** 装饰元素 */
export interface DecorationElements {
  /** 是否有分割线 */
  hasDivider: boolean;
  /** 分割线样式 */
  dividerStyle: 'line' | 'dots' | 'gradient' | 'none';
  /** 是否有角标/标签 */
  hasBadge: boolean;
  /** 圆角风格 */
  borderRadius: 'none' | 'small' | 'medium' | 'large' | 'pill';
  /** 是否有阴影效果 */
  hasShadow: boolean;
  /** 装饰风格整体倾向 */
  style: 'minimal' | 'elegant' | 'playful' | 'professional';
  /** 置信度 */
  confidence: number;
}

/** 完整视觉风格分析结果 */
export interface VisualStyleAnalysis {
  colorScheme: ColorScheme;
  layout: VisualLayout;
  font: FontProfile;
  decoration: DecorationElements;
  /** 分析来源：multimodal=多模态图片分析, default=默认推断 */
  source: 'multimodal' | 'default';
}

// ═══════════════════════════════════════════════════
// 多模态分析核心函数
// ═══════════════════════════════════════════════════

/**
 * 从小红书笔记截图中提取视觉风格
 *
 * @param imageUrls 图片 URL 列表（1-9张，支持 http/https/data:base64）
 * @returns 视觉风格分析结果
 */
export async function analyzeVisualStyleFromImages(
  imageUrls: string[],
  workspaceId?: string
): Promise<VisualStyleAnalysis> {
  if (!imageUrls || imageUrls.length === 0) {
    throw new Error('至少需要1张图片');
  }

  // 最多9张图片
  const urls = imageUrls.slice(0, 9);

  console.log('[VisualAnalyzer] 🖼️ 开始多模态视觉分析，图片数量:', urls.length);

  // BYOK: 优先使用用户 Key
  const { client: llmClient } = await createUserLLMClient(workspaceId);

  // 构建多模态消息：文字指令 + 图片
  const contentParts: ContentPart[] = [
    {
      type: 'text',
      text: VISUAL_ANALYSIS_PROMPT,
    },
  ];

  // 添加图片（high detail 确保颜色准确）
  for (const url of urls) {
    contentParts.push({
      type: 'image_url',
      image_url: { url, detail: 'high' },
    });
  }

  const messages: Message[] = [
    {
      role: 'user',
      content: contentParts,
    },
  ];

  try {
    // 使用视觉模型（doubao-seed-1-6-vision-250815 是视觉理解 SOTA）
    const response = await llmClient.invoke(messages, {
      model: 'doubao-seed-1-6-vision-250815',
      temperature: 0.3,  // 低温度，确保颜色值精确
    });

    const rawContent = response.content;
    console.log('[VisualAnalyzer] LLM 原始响应长度:', rawContent.length);

    // 解析 JSON
    const parsed = parseJsonFromLlmResponse(rawContent);
    if (!parsed) {
      console.warn('[VisualAnalyzer] ⚠️ LLM 返回非 JSON，使用降级方案');
      return getDefaultVisualStyle();
    }

    // 校验 + 规范化
    const analysis = normalizeVisualAnalysis(parsed);
    analysis.source = 'multimodal';

    console.log('[VisualAnalyzer] ✅ 视觉分析完成:', {
      primaryColor: analysis.colorScheme.primaryColor,
      tone: analysis.colorScheme.tone,
      style: analysis.decoration.style,
      confidence: analysis.colorScheme.confidence,
    });

    return analysis;
  } catch (error) {
    console.error('[VisualAnalyzer] ❌ 多模态分析失败，使用降级方案:', error);
    return getDefaultVisualStyle();
  }
}

// ═══════════════════════════════════════════════════
// LLM Prompt
// ═══════════════════════════════════════════════════

const VISUAL_ANALYSIS_PROMPT = `你是小红书图片卡片的视觉风格分析专家。请仔细观察上传的图片，提取以下视觉特征。

【重要】颜色值必须是精确的 HEX 格式（如 #FF6B6B），不要用模糊描述！

请从图片中提取以下信息，输出 JSON：

{
  "colorScheme": {
    "primaryColor": "HEX值 - 图片中面积最大的主色（渐变起始色）",
    "secondaryColor": "HEX值 - 辅助色（渐变终止色/次要色块）",
    "backgroundColor": "HEX值 - 卡片底色/背景色",
    "accentColor": "HEX值 - 强调色（数字序号、标签、CTA按钮的颜色）",
    "textPrimaryColor": "HEX值 - 主文字颜色（通常是标题）",
    "textSecondaryColor": "HEX值 - 副文字颜色（正文/说明文字）",
    "tone": "warm|cool|neutral|vibrant",
    "confidence": 0.0-1.0
  },
  "layout": {
    "contentTopRatio": 0.0-1.0（内容区顶部留白比例）,
    "contentSideRatio": 0.0-1.0（内容区左右留白比例）,
    "titleAlignment": "center|left|right",
    "hasBottomDecoration": true|false,
    "confidence": 0.0-1.0
  },
  "font": {
    "titleSize": "large|medium|small",
    "titleWeight": "bold|semibold|regular",
    "bodySize": "large|medium|small",
    "style": "bold|light|cute|formal|handwritten",
    "confidence": 0.0-1.0
  },
  "decoration": {
    "hasDivider": true|false,
    "dividerStyle": "line|dots|gradient|none",
    "hasBadge": true|false,
    "borderRadius": "none|small|medium|large|pill",
    "hasShadow": true|false,
    "style": "minimal|elegant|playful|professional",
    "confidence": 0.0-1.0
  }
}

【判断标准】
- tone: warm=红橙黄系, cool=蓝紫绿系, neutral=灰白黑系, vibrant=多色高饱和
- titleSize: large=占卡片1/3以上高度, medium=1/5-1/3, small=小于1/5
- borderRadius: 看卡片的圆角大小, pill=全圆角胶囊形
- decoration.style: minimal=几乎无装饰, elegant=细腻线条/渐变, playful=圆点/活泼元素, professional=严谨排版
- 如果上传了多张图，综合所有图片的共同风格特征

只输出 JSON，不要其他文字。`;

// ═══════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════

/**
 * 从 LLM 响应中解析 JSON（容错处理）
 */
function parseJsonFromLlmResponse(raw: string): Record<string, any> | null {
  // 清理 markdown 代码块
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  // 尝试直接解析
  try {
    return JSON.parse(cleaned);
  } catch {
    // 尝试提取 JSON 对象
    const braceStart = cleaned.indexOf('{');
    const braceEnd = cleaned.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
      try {
        return JSON.parse(cleaned.slice(braceStart, braceEnd + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * 校验 HEX 颜色值，非法值返回默认
 */
function validateHex(value: any, fallback: string): string {
  if (typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value)) {
    return value;
  }
  // 尝试修复：补 # 或简写
  if (typeof value === 'string') {
    const v = value.startsWith('#') ? value : '#' + value;
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v;
    if (/^#[0-9A-Fa-f]{3}$/.test(v)) {
      return '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
    }
  }
  return fallback;
}

/**
 * 校验枚举值，非法值返回默认
 */
function validateEnum<T extends string>(value: any, validValues: readonly T[], fallback: T): T {
  if (typeof value === 'string' && validValues.includes(value as T)) {
    return value as T;
  }
  return fallback;
}

/**
 * 校验数值范围
 */
function validateRange(value: any, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (Number.isFinite(num) && num >= min && num <= max) return num;
  return fallback;
}

/**
 * 规范化 LLM 输出为标准格式
 */
function normalizeVisualAnalysis(parsed: Record<string, any>): VisualStyleAnalysis {
  const cs = parsed.colorScheme || {};
  const layout = parsed.layout || {};
  const font = parsed.font || {};
  const deco = parsed.decoration || {};

  return {
    colorScheme: {
      primaryColor: validateHex(cs.primaryColor, '#FF6B6B'),
      secondaryColor: validateHex(cs.secondaryColor, '#FF8E53'),
      backgroundColor: validateHex(cs.backgroundColor, '#FFF5F5'),
      accentColor: validateHex(cs.accentColor, '#FF4757'),
      textPrimaryColor: validateHex(cs.textPrimaryColor, '#FFFFFF'),
      textSecondaryColor: validateHex(cs.textSecondaryColor, '#FFE0E0'),
      tone: validateEnum(cs.tone, ['warm', 'cool', 'neutral', 'vibrant'], 'warm'),
      confidence: validateRange(cs.confidence, 0, 1, 0.7),
    },
    layout: {
      contentTopRatio: validateRange(layout.contentTopRatio, 0, 1, 0.15),
      contentSideRatio: validateRange(layout.contentSideRatio, 0, 0.5, 0.08),
      titleAlignment: validateEnum(layout.titleAlignment, ['center', 'left', 'right'], 'center'),
      hasBottomDecoration: !!layout.hasBottomDecoration,
      confidence: validateRange(layout.confidence, 0, 1, 0.7),
    },
    font: {
      titleSize: validateEnum(font.titleSize, ['large', 'medium', 'small'], 'large'),
      titleWeight: validateEnum(font.titleWeight, ['bold', 'semibold', 'regular'], 'bold'),
      bodySize: validateEnum(font.bodySize, ['large', 'medium', 'small'], 'medium'),
      style: validateEnum(font.style, ['bold', 'light', 'cute', 'formal', 'handwritten'], 'bold'),
      confidence: validateRange(font.confidence, 0, 1, 0.7),
    },
    decoration: {
      hasDivider: !!deco.hasDivider,
      dividerStyle: validateEnum(deco.dividerStyle, ['line', 'dots', 'gradient', 'none'], 'none'),
      hasBadge: !!deco.hasBadge,
      borderRadius: validateEnum(deco.borderRadius, ['none', 'small', 'medium', 'large', 'pill'], 'medium'),
      hasShadow: !!deco.hasShadow,
      style: validateEnum(deco.style, ['minimal', 'elegant', 'playful', 'professional'], 'minimal'),
      confidence: validateRange(deco.confidence, 0, 1, 0.7),
    },
    source: 'multimodal',
  };
}

/**
 * 默认视觉风格（暖色极简，降级使用）
 */
export function getDefaultVisualStyle(): VisualStyleAnalysis {
  return {
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
  };
}

// ═══════════════════════════════════════════════════
// Phase 2: 内容模板分析（图片内容 + 结构 + 正文示例）
// ═══════════════════════════════════════════════════

/** 单张卡片的内容示例 */
export interface CardContentExample {
  /** 卡片类型 */
  cardType: 'cover' | 'point' | 'ending' | 'minimal-point';
  /** 图片上的文字（OCR提取） */
  imageText: string;
  /** 文字长度级别 */
  textLength: 'title_only' | 'short' | 'standard' | 'detailed';
  /** 风格描述（如"大标题居中"、"序号+标题+50字内容"） */
  styleDescription: string;
}

/** 内容模板结构信息 */
export interface ContentStructure {
  /** 卡片数量模式 */
  cardCountMode: '3-card' | '4-card' | '5-card' | '6-card' | '7-card';
  /** 内容密度风格 */
  densityStyle: 'minimal' | 'concise' | 'standard' | 'detailed';
  /** 结构描述（自然语言，用于展示） */
  description: string;
  /** 置信度 */
  confidence: number;
}

/** 完整内容模板（从参考笔记提取） */
export interface ContentTemplate {
  /** 每张卡片的内容示例 */
  cardExamples: CardContentExample[];
  /** 结构总结 */
  structure: ContentStructure;
  /** 正文区的写作风格/特点描述 */
  textStyleDescription?: string;
  /** 图文分工规则（精简版） */
  divisionRule: {
    /** 图片专属放什么 */
    imageOnly: string[];
    /** 正文专属放什么 */
    textOnly: string[];
  };
  /** 分析来源 */
  source: 'multimodal' | 'default';
  /** 自动生成的模板名称（如 "5卡-标准风"）—— 由 generateTemplateName() 生成 */
  name?: string;
  /** 精简指令（~50字）—— 由 generatePromptInstruction() 生成 */
  promptInstruction?: string;
}

/**
 * 🔥 从小红书笔记截图中提取完整内容模板
 *
 * 包含：
 * 1. OCR 提取每张卡片的文字内容
 * 2. 总结图文结构（数量、密度、风格）
 * 3. 分析图文分工规则
 * 4. 生成精简指令（用于 Prompt 注入）
 *
 * @param imageUrls 图片 URL 列表
 * @param articleText 笔记正文文本（可选，用于对比分析图文关系）
 * @returns 完整内容模板
 */
export async function analyzeContentTemplateFromImages(
  imageUrls: string[],
  articleText?: string,
  workspaceId?: string
): Promise<ContentTemplate> {
  if (!imageUrls || imageUrls.length === 0) {
    throw new Error('至少需要1张图片');
  }

  const urls = imageUrls.slice(0, 9); // 最多9张图
  console.log('[ContentAnalyzer] 📝 开始内容模板分析，图片数:', urls.length, '有正文:', !!articleText);

  // BYOK: 优先使用用户 Key
  const { client: llmClient } = await createUserLLMClient(workspaceId);

  const contentParts: ContentPart[] = [
    { type: 'text', text: CONTENT_TEMPLATE_PROMPT(articleText) },
  ];

  for (const url of urls) {
    contentParts.push({ type: 'image_url', image_url: { url, detail: 'high' } });
  }

  const messages: Message[] = [{ role: 'user', content: contentParts }];

  try {
    const response = await llmClient.invoke(messages, {
      model: 'doubao-seed-1-6-vision-250815',
      temperature: 0.2,
    });

    const rawContent = response.content;
    console.log('[ContentAnalyzer] LLM 原始响应长度:', rawContent.length);

    const parsed = parseJsonFromLlmResponse(rawContent);
    if (!parsed) {
      console.warn('[ContentAnalyzer] ⚠️ LLM 返回非 JSON，使用降级方案');
      return getDefaultContentTemplate();
    }

    const template = normalizeContentTemplate(parsed);
    template.source = 'multimodal';

    // 🔥 自动生成 name 和 promptInstruction（关键：否则前端展示空白）
    template.name = generateTemplateName(template);
    template.promptInstruction = generatePromptInstruction(template);

    console.log('[ContentAnalyzer] ✅ 内容模板分析完成:', {
      cardCount: template.cardExamples.length,
      mode: template.structure.cardCountMode,
      density: template.structure.densityStyle,
      name: template.name,
      promptInstruction: template.promptInstruction,
    });

    return template;
  } catch (error) {
    console.error('[ContentAnalyzer] ❌ 内容模板分析失败，使用降级方案:', error);
    return getDefaultContentTemplate();
  }
}

/**
 * 🔥 生成精简 Prompt 指令（从内容模板压缩为50字以内的指令）
 *
 * 用于注入 insurance-d 的 Prompt，避免 Token 浪费
 */
export function generatePromptInstruction(template: ContentTemplate): string {
  const parts: string[] = [];

  // 1. 卡片数量和密度
  parts.push(`${template.structure.cardCountMode}模式`);

  // 2. 各卡片的文字量要求
  const coverCard = template.cardExamples.find(c => c.cardType === 'cover');
  const pointCards = template.cardExamples.filter(c => c.cardType === 'point');
  const endingCard = template.cardExamples.find(c => c.cardType === 'ending');

  // 封面卡指导
  if (coverCard) {
    switch (coverCard.textLength) {
      case 'title_only': parts.push('封面仅主标题'); break;
      case 'short': parts.push('封面标题+副标题'); break;
      default: parts.push('封面标准格式');
    }
  }

  // 要点卡指导
  if (pointCards.length > 0) {
    const pointLengths = pointCards.map(p => p.textLength);
    const dominant = pointLengths[0];
    if (dominant === 'title_only') {
      parts.push('要点仅标题无内容');
    } else if (dominant === 'short') {
      parts.push('要点标题+简短说明(≤30字)');
    } else if (dominant === 'detailed') {
      parts.push('要点标题+详细内容(≤100字)');
    } else {
      parts.push('要点标题+标准内容(≤60字)');
    }
  }

  // 结尾卡指导
  if (endingCard) {
    switch (endingCard.textLength) {
      case 'title_only': parts.push('结尾仅总结语'); break;
      case 'short': parts.push('结尾总结+少量标签'); break;
      default: parts.push('结尾总结+标签');
    }
  }

  // 3. 图文分工核心规则
  if (Array.isArray(template.divisionRule?.imageOnly) && template.divisionRule.imageOnly.length > 0) {
    parts.push(`图片放${template.divisionRule.imageOnly.slice(0, 2).join('/')}`);
  }
  if (Array.isArray(template.divisionRule?.textOnly) && template.divisionRule.textOnly.length > 0) {
    parts.push(`正文放${template.divisionRule.textOnly.slice(0, 2).join('/')}`);
  }

  return parts.join('；') + '。';
}

/**
 * 自动生成模板名称（基于内容特征）
 * 🔥🔥🔥 【P1-2修复】动态计算卡片数量标签
 */
export function generateTemplateName(template: ContentTemplate): string {
  const parts: string[] = [];
  
  // 🔥 动态计算卡片数量标签，支持任意 N-card 格式
  const cardCountMode = template.structure.cardCountMode || '5-card';
  const countLabel = cardCountMode.replace('-card', '卡');
  parts.push(countLabel);

  // 密度风格
  const densityMap: Record<string, string> = {
    minimal: '极简', concise: '精简', standard: '标准', detailed: '详尽',
  };
  parts.push(densityMap[template.structure.densityStyle] || '标准');

  // 色调（如果有视觉风格）
  // 注意：这里不直接引用 VisualStyleAnalysis，因为可能没有传入
  // 调用方可以自行拼接色调

  return `${parts.join('-')}风`;
}

// ═══════════════════════════════════════════════════
// Content Template LLM Prompt
// ═══════════════════════════════════════════════════

function CONTENT_TEMPLATE_PROMPT(articleText?: string): string {
  const textContext = articleText
    ? `\n\n【笔记正文】（供对比图文关系）\n${articleText.slice(0, 2000)}${articleText.length > 2000 ? '...(已截断)' : ''}`
    : '';

  return `你是小红书笔记的「内容结构」分析专家。请仔细观察上传的图片，提取内容模板。

【任务】
1. 用OCR识别每张图片上的文字内容
2. 判断每张卡的类型（封面/要点/结尾）
3. 总结图文结构和分工规则
4. 如果提供了正文，分析图片文字与正文的关系

请输出 JSON：

{
  "cardExamples": [
    {
      "cardType": "cover|point|ending|minimal-point",
      "imageText": "图片上的实际文字（原样保留）",
      "textLength": "title_only|short|standard|detailed",
      "styleDescription": "如：大标题居中、序号圆圈+标题+短内容"
    }
  ],
  "structure": {
    "cardCountMode": "3-card|4-card|5-card|6-card|7-card",
    "densityStyle": "minimal|concise|standard|detailed",
    "description": "一句话描述整体结构",
    "confidence": 0.0-1.0
  },
  "divisionRule": {
    "imageOnly": ["图片上放什么", "如：标题、金句、数字"],
    "textOnly": ["正文区放什么", "如：论证、案例、数据"]
  },
  "textStyleDescription": "正文的写作风格特点（如有正文则分析）"
}${textContext}

【判断标准】
- cardType: 封面=有主标题大字; 要点=有序号①②③或数字; 结尾=有标签#或关注我
- textLength: title_only=仅标题(<15字); short=标题+副文案(15-40字); standard=标题+内容(40-80字); detailed=长内容(>80字)
- densityStyle: minimal=所有卡都是title_only; concise=大部分是title_only或short; standard=混合; detailed=大部分是standard或detailed
- divisionRule: 根据图片上的文字特征判断，图片通常放结论性/吸引眼球的内容，正文放论证性/支撑性内容

只输出 JSON，不要其他文字。`;
}

// ═══════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════

function normalizeContentTemplate(parsed: Record<string, any>): ContentTemplate {
  let examples = Array.isArray(parsed.cardExamples)
    ? parsed.cardExamples.map((c: any) => ({
        cardType: validateEnum(c.cardType, ['cover', 'point', 'ending', 'minimal-point'], 'point'),
        imageText: typeof c.imageText === 'string' ? c.imageText : '',
        textLength: validateEnum(c.textLength, ['title_only', 'short', 'standard', 'detailed'], 'standard'),
        styleDescription: typeof c.styleDescription === 'string' ? c.styleDescription : '',
      }))
    : [];

  // 🔥🔥🔥 【源头修复】强制修正卡片类型（基于位置推断）
  // 小红书5卡结构：第1张=封面，中间=要点，最后=结尾
  if (examples.length >= 3) {
    // 第1张强制为封面
    if (examples[0].cardType !== 'cover') {
      console.log('[ContentAnalyzer] 🔧 强制修正第1张为封面卡（原:', examples[0].cardType, '）');
      examples[0] = { ...examples[0], cardType: 'cover' };
    }
    // 最后一张强制为结尾
    const lastIdx = examples.length - 1;
    if (examples[lastIdx].cardType !== 'ending') {
      console.log('[ContentAnalyzer] 🔧 强制修正第', lastIdx + 1, '张为结尾卡（原:', examples[lastIdx].cardType, '）');
      examples[lastIdx] = { ...examples[lastIdx], cardType: 'ending' };
    }
    // 中间张强制为要点
    for (let i = 1; i < lastIdx; i++) {
      if (examples[i].cardType !== 'point' && examples[i].cardType !== 'minimal-point') {
        console.log('[ContentAnalyzer] 🔧 强制修正第', i + 1, '张为要点卡（原:', examples[i].cardType, '）');
        examples[i] = { ...examples[i], cardType: 'point' };
      }
    }
  }

  const struct = parsed.structure || {};

  return {
    cardExamples: examples,
    structure: {
      cardCountMode: validateEnum(struct.cardCountMode, ['3-card', '4-card', '5-card', '6-card', '7-card'], '5-card'),
      densityStyle: validateEnum(struct.densityStyle, ['minimal', 'concise', 'standard', 'detailed'], 'standard'),
      description: typeof struct.description === 'string' ? struct.description : '',
      confidence: validateRange(struct.confidence, 0, 1, 0.7),
    },
    textStyleDescription: typeof parsed.textStyleDescription === 'string' ? parsed.textStyleDescription : undefined,
    divisionRule: {
      imageOnly: Array.isArray(parsed.divisionRule?.imageOnly) ? parsed.divisionRule.imageOnly : ['标题', '要点'],
      textOnly: Array.isArray(parsed.divisionRule?.textOnly) ? parsed.divisionRule.textOnly : ['论证', '案例'],
    },
    source: 'multimodal',
  };
}

export function getDefaultContentTemplate(): ContentTemplate {
  const template: ContentTemplate = {
    cardExamples: [
      { cardType: 'cover', imageText: '', textLength: 'standard', styleDescription: '大标题居中' },
      { cardType: 'point', imageText: '', textLength: 'standard', styleDescription: '序号+标题+内容' },
      { cardType: 'point', imageText: '', textLength: 'standard', styleDescription: '序号+标题+内容' },
      { cardType: 'point', imageText: '', textLength: 'standard', styleDescription: '序号+标题+内容' },
      { cardType: 'ending', imageText: '', textLength: 'short', styleDescription: '总结+标签' },
    ],
    structure: {
      cardCountMode: '5-card',
      densityStyle: 'standard',
      description: '标准5卡模式：封面+3个要点+结尾',
      confidence: 0.5,
    },
    textStyleDescription: '详细论证每个要点',
    divisionRule: {
      imageOnly: ['标题', '要点'],
      textOnly: ['论证', '案例'],
    },
    source: 'default',
  };
  // 🔥 自动生成 name 和 promptInstruction
  template.name = generateTemplateName(template);
  template.promptInstruction = generatePromptInstruction(template);
  return template;
}
