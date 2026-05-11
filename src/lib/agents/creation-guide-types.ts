/**
 * 创作引导 - 常量与类型定义
 * 对应文档：docs/重要-素材-类比详细设计方案.md
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
}));

/** @deprecated 使用 ArticleTypeKey */
export type ArticleType = ArticleTypeKey;

// ==================== 场景类型 ====================

export const SCENE_TYPES = {
  analogy: { key: 'analogy', label: '类比案例', color: '#6366f1', description: '用日常生活类比解释保险概念' },
  mistake: { key: 'mistake', label: '常见误区', color: '#ef4444', description: '普遍存在的认知错误或思维陷阱' },
  regulation: { key: 'regulation', label: '法规依据', color: '#059669', description: '法律条文、监管规定、行业标准' },
  event: { key: 'event', label: '热点事件', color: '#f59e0b', description: '近期社会事件、新闻、真实案例' },
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

// ==================== 结构化数据类型 ====================

export interface AnalogyConfig {
  /** 类比方向：daily_life(日常类比) / cross_domain(跨领域类比) */
  direction: 'daily_life' | 'cross_domain';
  /** 类比风格：humorous(幽默) / sober(清醒) / professional(专业) */
  style: 'humorous' | 'sober' | 'professional';
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
  return (ARTICLE_TYPES as any)[key]?.label ?? key;
}

export function getSceneTypeLabel(key: string): string {
  return (SCENE_TYPES as any)[key]?.label ?? key;
}

export function getEmotionToneLabel(key: string): string {
  return (EMOTION_TONES as any)[key]?.label ?? key;
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
};
