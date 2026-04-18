/**
 * 风格分析 5 维度类型定义
 *
 * 统一类型文件，供以下模块共享引用：
 * - style-deposition-service.ts（服务层：analyzeToneProfile / analyzeLanguageStyle / analyzeVocabulary / analyzeContentNorms / analyzeLayout）
 * - /api/style/init-from-upload/route.ts（API 层）
 * - /style-init/page.tsx（前端层）
 */

// ═══════════════════════════════════════════════════
// 维度①：整体调性（LLM 驱动 → analyzeToneProfile）
// ═══════════════════════════════════════════════════

export interface OverallToneAnalysis {
  /** 消费者立场 (1-10) */
  consumerStance: number;
  /** 产品中立性 (1-10) */
  productNeutrality: number;
  /** 专业性 (1-10) */
  professionalism: number;
  /** 温度感/共情能力 (1-10) */
  warmth: number;
  /** 避坑导向 (1-10) */
  pitfallFocus: number;
  /** 一句话总结整体调性 */
  overallTone: string;
  /** 详细说明 */
  summary: string;
}

// ═══════════════════════════════════════════════════
// 维度②：语气与口吻（纯 NLP → analyzeLanguageStyle）
// ═══════════════════════════════════════════════════

export interface ToneAndVoiceAnalysis {
  pronounStats: {
    niCount: number;       // 「你」使用次数
    ninCount: number;      // 「咱们」使用次数
    ninmenCount: number;   // 「你们」使用次数
    ninGuaiguiCount: number; // 「您/贵」使用次数
    kehuCount: number;     // 「客户」使用次数
    totalPronouns: number; // 代词总次数
  };
  /** 口语化标记词密度 (0-1) */
  colloquialismScore: number;
  /** 焦虑/夸大词密度 (0-1)，越高越焦虑 */
  anxietyLevel: number;
  /** 正式度判断 */
  formalityLevel: 'informal' | 'neutral' | 'formal';
  summary: string;
}

// ═══════════════════════════════════════════════════
// 维度④：表达习惯（增强版 NLP → analyzeVocabulary）
// ═══════════════════════════════════════════════════

export interface ExpressionHabitsAnalysis {
  /** 高频特色词汇 TOP20 */
  highFrequencyWords: Array<{ word: string; count: number }>;
  /** 禁用词检测结果 */
  forbiddenWords: Array<{ pattern: string; matches: string[]; count: number }>;
  /** 绝对化表达词 */
  absoluteWords: Array<{ word: string; count: number }>;
  /** 自定义行业词汇分类 */
  customVocabulary: Array<{ word: string; category: string; count: number }>;
  summary: string;
}

// ═══════════════════════════════════════════════════
// 维度⑤：内容细节（实体白名单匹配 → analyzeContentNorms）
// ═══════════════════════════════════════════════════

export interface ContentDetailAnalysis {
  /** 检测到的匿名案例名（白名单内） */
  caseNames: string[];
  /** 检测到的官方数据源（白名单内） */
  officialSources: string[];
  /** 是否包含合规声明（文末500字） */
  hasComplianceStatement: boolean;
  /** 不合规案例名（疑似真实姓名） */
  nonCompliantCaseNames: string[];
  /** 不合规数据源（非官方来源） */
  nonCompliantSources: string[];
  /** 数据引用率 */
  dataCitationRate: number;
  summary: string;
}

// ═══════════════════════════════════════════════════
// 维度⑥：排版风格（段落级分析 → analyzeLayout）
// ═══════════════════════════════════════════════════

export interface FormattingStyleAnalysis {
  /** 平均段长（字数） */
  avgParagraphLength: number;
  /** 短段占比 (0-1) */
  shortParagraphRatio: number;
  /** 长段占比 (0-1) */
  longParagraphRatio: number;
  /** 小标题数量 */
  headingCount: number;
  /** 小标题模式描述 */
  headingPattern: string;
  /** 平均句长（字数） */
  avgSentenceLength: number;
  /** 总字数（中文字符+英文单词） */
  totalWordCount: number;
  /** 目标字数（用户设定） */
  targetWordCount: number | null;
  /** 是否符合目标排版 */
  compliance: boolean;
  summary: string;
}

// ═══════════════════════════════════════════════════
// 编排结果容器
// ═══════════════════════════════════════════════════

/** 5 维度完整分析结果（由 analyzeSixDimensions 编排器产出） */
export interface SixDimensionAnalysis {
  /** 维度① 整体调性（LLM） */
  overallTone: OverallToneAnalysis | null;
  /** 维度② 语气与口吻（NLP） */
  toneAndVoice: ToneAndVoiceAnalysis | null;
  /** 维度④ 表达习惯（NLP 增强） */
  expressionHabits: ExpressionHabitsAnalysis | null;
  /** 维度⑤ 内容细节（实体匹配） */
  contentDetails: ContentDetailAnalysis | null;
  /** 维度⑥ 排版风格（段落级） */
  formattingStyle: FormattingStyleAnalysis | null;
  /** 维度③ 文章结构（待后续实现） */
  articleStructure: null;
}

// ═══════════════════════════════════════════════════
// 小红书风格分析结果（多模态 LLM 产出）
// ═══════════════════════════════════════════════════

/** 小红书风格分析结果（纯类型，无服务端依赖，可供前端安全导入） */
export interface XiaohongshuStyleAnalysis {
  // 标题套路分析
  titlePattern: {
    type: 'suspense' | 'revelation' | 'numbered' | 'contrast' | 'emotional' | 'story' | 'question';
    pattern: string;
    examples: string[];
    confidence: number;
  };
  // emoji 使用习惯
  emojiUsage: {
    density: 'low' | 'medium' | 'high';
    commonEmojis: string[];
    positionPattern: string;
    confidence: number;
  };
  // 图文排版风格
  visualLayout: {
    paragraphStyle: 'short' | 'medium' | 'long';
    lineBreakFrequency: 'high' | 'medium' | 'low';
    bulletPointStyle: 'numbered' | 'dotted' | 'emoji' | 'none';
    avgParagraphLength: number;
    pointCount: number;
    confidence: number;
  };
  // 语气基调
  tone: {
    primary: 'empathetic' | 'professional' | 'warning' | 'warm' | 'casual';
    secondary?: string;
    description: string;
    confidence: number;
  };
  // 高频词汇
  vocabulary: {
    highFrequencyWords: Array<{ word: string; count: number }>;
    catchphrases: string[];
    transitionWords: string[];
    confidence: number;
  };
  // 卡片风格（通过图片分析）
  cardStyle?: {
    colorScheme: 'warm' | 'cool' | 'neutral' | 'vibrant';
    decorationStyle: 'minimal' | 'elegant' | 'playful' | 'professional';
    fontStyle: 'bold' | 'light' | 'cute' | 'formal';
    confidence: number;
  };
  // 视觉风格（多模态图片分析，精确配色+布局+装饰）
  visualStyle?: {
    colorScheme: {
      primaryColor: string;
      secondaryColor: string;
      backgroundColor: string;
      accentColor: string;
      textPrimaryColor: string;
      textSecondaryColor: string;
      tone: 'warm' | 'cool' | 'neutral' | 'vibrant';
      confidence: number;
    };
    layout: {
      contentTopRatio: number;
      contentSideRatio: number;
      titleAlignment: 'center' | 'left' | 'right';
      hasBottomDecoration: boolean;
      confidence: number;
    };
    font: {
      titleSize: 'large' | 'medium' | 'small';
      titleWeight: 'bold' | 'semibold' | 'regular';
      bodySize: 'large' | 'medium' | 'small';
      style: 'bold' | 'light' | 'cute' | 'formal' | 'handwritten';
      confidence: number;
    };
    decoration: {
      hasDivider: boolean;
      dividerStyle: 'line' | 'dots' | 'gradient' | 'none';
      hasBadge: boolean;
      borderRadius: 'none' | 'small' | 'medium' | 'large' | 'pill';
      hasShadow: boolean;
      style: 'minimal' | 'elegant' | 'playful' | 'professional';
      confidence: number;
    };
    source: 'multimodal' | 'default';
  };
  // 图文结构
  imageStructure: {
    imageCountMode: '3-card' | '5-card' | '7-card';
    cardTextDensity: 'minimal' | 'concise' | 'standard';
    contentDistribution: {
      imageOnlyPoints: string[];
      textOnlyDetails: string[];
      bothSummary: string[];
    };
    cardArchitecture: Array<{
      cardIndex: number;
      cardType: 'cover' | 'key-point' | 'detail' | 'ending';
      headline: string;
      subtext?: string;
      purpose: string;
    }>;
    confidence: number;
  };
  // 内容模板（多模态分析：图片内容+图文结构+分工规则）
  contentTemplate?: {
    name: string;
    source: 'multimodal' | 'default';
    structure: {
      cardCountMode: string;
      densityStyle: string;
      description: string;
    };
    cardExamples: Array<{
      cardType: string;
      imageText: string;
      textLength: string;
      styleDescription: string;
    }>;
    divisionRule: {
      imageOnly: string[];
      textOnly: string[];
    };
    promptInstruction?: string;
  };
}
