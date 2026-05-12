/**
 * 创作引导 - 常量与类型定义
 * 对应文档：docs/重要-素材-类比详细设计方案.md
 * Phase 1: 避坑指南/权威解读/故事驱动/自由创作
 * Phase 2: 产品测评/投保指南
 * Phase 3: AI 辅助生成
 */

// ==================== 创作类型 ====================

export const ARTICLE_TYPES = {
  /** 避坑指南：误区拆解 + 类比映射 */
  pitfall_guide: {
    key: 'pitfall_guide',
    label: '避坑指南',
    description: '误区拆解 + 类比映射，帮助读者识别常见陷阱',
    icon: '🚫',
    requiredSceneTypes: ['mistake', 'analogy'] as const,
    optionalSceneTypes: ['regulation', 'event'] as const,
    minMaterials: { mistake: 1, analogy: 1 },
  },
  /** 权威解读：法规依据 + 事件印证 */
  authority_analysis: {
    key: 'authority_analysis',
    label: '权威解读',
    description: '法规依据 + 事件印证，建立专业权威感',
    icon: '📋',
    requiredSceneTypes: ['regulation'] as const,
    optionalSceneTypes: ['event', 'analogy'] as const,
    minMaterials: { regulation: 1 },
  },
  /** 故事驱动：真实事件 + 类比共鸣 */
  story_driven: {
    key: 'story_driven',
    label: '故事驱动',
    description: '真实事件 + 类比共鸣，用叙事打动读者',
    icon: '📖',
    requiredSceneTypes: ['event', 'analogy'] as const,
    optionalSceneTypes: ['mistake'] as const,
    minMaterials: { event: 1, analogy: 1 },
  },
  /** 自由创作：无硬性素材要求 */
  free_creation: {
    key: 'free_creation',
    label: '自由创作',
    description: '自由选择素材，无硬性要求',
    icon: '✏️',
    requiredSceneTypes: [] as const,
    optionalSceneTypes: ['analogy', 'mistake', 'regulation', 'event'] as const,
    minMaterials: {},
  },
  /** 产品测评：产品对比 + 优劣势分析（Phase 2） */
  product_eval: {
    key: 'product_eval',
    label: '产品测评',
    description: '产品对比测评，优劣势分析+选购建议',
    icon: '🔍',
    requiredSceneTypes: ['product'] as const,
    optionalSceneTypes: ['analogy', 'regulation', 'mistake'] as const,
    minMaterials: { product: 1 },
    hasStructuredData: true,
  },
  /** 投保指南：人群画像+需求分析+方案推荐（Phase 2） */
  insurance_guide: {
    key: 'insurance_guide',
    label: '投保指南',
    description: '人群画像+需求分析，量身定制投保方案',
    icon: '🧭',
    requiredSceneTypes: ['regulation'] as const,
    optionalSceneTypes: ['analogy', 'event', 'mistake'] as const,
    minMaterials: { regulation: 1 },
    hasStructuredData: true,
  },
} as const;

export type ArticleTypeKey = keyof typeof ARTICLE_TYPES;

/** 创作类型选项列表（前端 UI 使用） */
export const ARTICLE_TYPE_OPTIONS = Object.values(ARTICLE_TYPES).map(t => ({
  key: t.key,
  label: t.label,
  description: t.description,
  icon: t.icon,
  requiredSceneTypes: [...t.requiredSceneTypes],
  optionalSceneTypes: [...t.optionalSceneTypes],
  minMaterials: { ...t.minMaterials },
  hasStructuredData: !!(t as Record<string, unknown>).hasStructuredData,
}));

/** @deprecated 使用 ArticleTypeKey */
export type ArticleType = ArticleTypeKey;

// ==================== 场景类型 ====================

export const SCENE_TYPES = {
  analogy: { key: 'analogy', label: '类比案例', color: '#6366f1', description: '用日常生活类比解释保险概念' },
  mistake: { key: 'mistake', label: '常见误区', color: '#ef4444', description: '普遍存在的认知错误或思维陷阱' },
  regulation: { key: 'regulation', label: '法规依据', color: '#059669', description: '法律条文、监管规定、行业标准' },
  event: { key: 'event', label: '热点事件', color: '#f59e0b', description: '近期社会事件、新闻、真实案例' },
  product: { key: 'product', label: '产品素材', color: '#8b5cf6', description: '保险产品信息、条款、费率数据' },
} as const;

export type SceneTypeKey = keyof typeof SCENE_TYPES;

// ==================== 情感基调 ====================

export const EMOTION_TONES = {
  rational: { key: 'rational', label: '理性客观', description: '数据说话，冷静分析' },
  warning: { key: 'warning', label: '踩坑警醒', description: '揭示风险，避免踩坑' },
  empathetic: { key: 'empathetic', label: '温情共情', description: '站在用户角度，理解感受' },
  professional: { key: 'professional', label: '专业权威', description: '展现专业深度，建立信任' },
} as const;

export type EmotionToneKey = keyof typeof EMOTION_TONES;

// ==================== 文章篇幅 ====================

export const ARTICLE_LENGTHS = {
  short: { key: 'short', label: '短文', wordRange: '800-1500字', minWords: 800, maxWords: 1500 },
  medium: { key: 'medium', label: '中篇', wordRange: '1500-3000字', minWords: 1500, maxWords: 3000 },
  long: { key: 'long', label: '长文', wordRange: '3000-5000字', minWords: 3000, maxWords: 5000 },
} as const;

export type ArticleLengthKey = keyof typeof ARTICLE_LENGTHS;

// ==================== 结构化数据类型 ====================

export interface AnalogyConfig {
  /** 类比方向：daily_life(日常类比) / cross_domain(跨领域类比) */
  direction: 'daily_life' | 'cross_domain';
  /** 类比风格：humorous(幽默) / sober(清醒) / professional(专业) */
  style: 'humorous' | 'sober' | 'professional';
}

/** 产品测评结构化数据（Phase 2） */
export interface ProductEvaluationStructuredData {
  /** 测评产品列表 */
  products: Array<{
    name: string;
    company: string;
    type: string;
  }>;
  /** 测评维度（如：保障范围/保费/免责条款/理赔条件） */
  dimensions: string[];
  /** 目标人群 */
  targetAudience?: string;
}

/** 投保指南结构化数据（Phase 2） */
export interface InsuranceGuideStructuredData {
  /** 目标人群画像 */
  targetGroup: string;
  /** 核心需求（如：重疾保障/医疗费用/意外防护） */
  coreNeeds: string[];
  /** 预算范围 */
  budgetRange?: string;
  /** 关注重点（如：性价比/品牌/理赔速度） */
  focusPoints?: string[];
}

export interface CreationGuideStructuredData {
  /** 创作类型 */
  articleType: ArticleTypeKey;
  /** 情感基调 */
  emotionTone: EmotionToneKey;
  /** 类比配置（仅避坑指南/故事驱动需要） */
  analogyConfig?: AnalogyConfig;
  /** 核心观点 */
  coreOpinion?: string;
  /** 已选素材ID列表 */
  selectedMaterialIds?: string[];
  /** 文章篇幅（Phase 2） */
  articleLength?: ArticleLengthKey;
  /** 主素材ID（Phase 2：产品测评的产品素材/投保指南的法规素材） */
  primaryMaterialId?: string;
  /** 辅助素材ID列表（Phase 2） */
  auxiliaryMaterialIds?: string[];
  /** 产品测评结构化数据（Phase 2） */
  productEvalData?: ProductEvaluationStructuredData;
  /** 投保指南结构化数据（Phase 2） */
  insuranceGuideData?: InsuranceGuideStructuredData;
}

// ==================== AI 辅助生成类型（Phase 3） ====================

/** AI 生成误区素材请求 */
export interface AIGenerateMistakeRequest {
  /** 用户输入的错误认知 */
  wrongBelief: string;
  /** 保险类型上下文（可选） */
  insuranceContext?: string;
}

/** AI 生成误区素材结果 */
export interface AIGenerateMistakeResult {
  /** 误区标题 */
  title: string;
  /** 错误认知描述 */
  wrongBelief: string;
  /** 正确认知 */
  correctUnderstanding: string;
  /** 破局逻辑 */
  debunkLogic: string;
  /** 推荐类比方向 */
  recommendedAnalogies: Array<{
    direction: 'daily_life' | 'cross_domain';
    example: string;
  }>;
  /** 数据支撑（如有） */
  dataSupport?: string;
}

/** AI 生成法规解读请求 */
export interface AIGenerateRegulationRequest {
  /** 法规原文 */
  regulationText: string;
  /** 法规名称（可选） */
  regulationName?: string;
  /** 解读角度（可选） */
  perspective?: string;
}

/** AI 生成法规解读结果 */
export interface AIGenerateRegulationResult {
  /** 法规标题 */
  title: string;
  /** 法规名称 */
  regulationName: string;
  /** 通俗解读 */
  plainExplanation: string;
  /** 关键要点列表 */
  keyPoints: string[];
  /** 对消费者的影响 */
  consumerImpact: string;
  /** 实用建议 */
  practicalAdvice: string;
}

// ==================== 素材校验结果 ====================

export interface MaterialValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  /** 各场景类型的已选数量 */
  sceneTypeCounts: Record<SceneTypeKey, number>;
  /** 缺少的必要场景类型 */
  missingRequired: SceneTypeKey[];
  /** 建议添加的场景类型 */
  suggestedOptional: SceneTypeKey[];
}

// ==================== 辅助函数 ====================

export function getArticleTypeLabel(key: string): string {
  return (ARTICLE_TYPES as Record<string, { label: string }>)[key]?.label ?? key;
}

export function getSceneTypeLabel(key: string): string {
  return (SCENE_TYPES as Record<string, { label: string }>)[key]?.label ?? key;
}

export function getEmotionToneLabel(key: string): string {
  return (EMOTION_TONES as Record<string, { label: string }>)[key]?.label ?? key;
}

export function getArticleLengthLabel(key: string): string {
  return (ARTICLE_LENGTHS as Record<string, { label: string }>)[key]?.label ?? key;
}

/** 获取创作类型要求的场景类型列表（含必选和可选） */
export function getRequiredSceneTypes(articleType: ArticleTypeKey): SceneTypeKey[] {
  const config = ARTICLE_TYPES[articleType];
  if (!config) return [];
  return [...config.requiredSceneTypes];
}

export function getOptionalSceneTypes(articleType: ArticleTypeKey): SceneTypeKey[] {
  const config = ARTICLE_TYPES[articleType];
  if (!config) return [];
  return [...config.optionalSceneTypes];
}

/** 创作类型的素材要求描述（前端 UI 使用） */
export const ARTICLE_TYPE_REQUIREMENTS: Record<ArticleTypeKey, { required: string[]; optional: string[] }> = {
  pitfall_guide: {
    required: ['至少1条常见误区素材', '至少1条类比案例素材'],
    optional: ['法规依据素材（推荐）', '热点事件素材（推荐）'],
  },
  authority_analysis: {
    required: ['至少1条法规依据素材'],
    optional: ['热点事件素材（推荐）', '类比案例素材（推荐）'],
  },
  story_driven: {
    required: ['至少1条热点事件素材', '至少1条类比案例素材'],
    optional: ['常见误区素材（推荐）'],
  },
  free_creation: {
    required: [],
    optional: ['类比案例素材', '常见误区素材', '法规依据素材', '热点事件素材'],
  },
  product_eval: {
    required: ['至少1条产品素材'],
    optional: ['类比案例素材（帮助解释产品概念）', '法规依据素材（条款依据）', '常见误区素材（选购误区）'],
  },
  insurance_guide: {
    required: ['至少1条法规依据素材'],
    optional: ['类比案例素材（帮助理解）', '热点事件素材（真实案例）', '常见误区素材（避坑）'],
  },
};

/** 创作类型 → 结构模板映射 */
export const ARTICLE_TYPE_STRUCTURE_MAP: Record<ArticleTypeKey, string> = {
  pitfall_guide: 'myth_busting',
  authority_analysis: 'regulation_interpretation',
  story_driven: 'event_analogy',
  free_creation: 'free',
  product_eval: 'product_evaluation',
  insurance_guide: 'insurance_guide',
};
