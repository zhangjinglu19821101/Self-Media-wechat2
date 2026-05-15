/**
 * 素材格式化工具
 * 统一将 material_library 数据库记录转为前端 MaterialItem 接口格式
 * 7维关系型素材：misconception/analogy/case/data/golden_sentence/fixed_phrase/personal_fragment
 * 补充类型：hook_sentence/value_reconstruction
 * 旧素材类型：story/quote/opening/ending
 */

/** 素材类型配置（所有类型统一维护） */
export const MATERIAL_TYPE_CONFIG: Record<string, {
  label: string;
  badgeType: string;
  contentLabel: string;
  color: string;
  icon: string;
}> = {
  // 7维关系型素材
  misconception: {
    label: '错误认知',
    badgeType: 'warning',
    contentLabel: '错误认知内容',
    color: 'amber',
    icon: '⚠️',
  },
  analogy: {
    label: '生活类比',
    badgeType: 'analogy',
    contentLabel: '类比内容',
    color: 'cyan',
    icon: '💡',
  },
  case: {
    label: '真实案例',
    badgeType: 'case',
    contentLabel: '案例经过',
    color: 'orange',
    icon: '📋',
  },
  data: {
    label: '权威数据',
    badgeType: 'data',
    contentLabel: '数据内容',
    color: 'blue',
    icon: '📊',
  },
  golden_sentence: {
    label: '金句',
    badgeType: 'golden',
    contentLabel: '金句内容',
    color: 'yellow',
    icon: '✨',
  },
  fixed_phrase: {
    label: '固定句式',
    badgeType: 'phrase',
    contentLabel: '句式内容',
    color: 'slate',
    icon: '📝',
  },
  personal_fragment: {
    label: '个人碎片',
    badgeType: 'personal',
    contentLabel: '碎片内容',
    color: 'purple',
    icon: '🧩',
  },
  // 补充7维类型（与 article-extraction-service.ts 对齐）
  hook_sentence: {
    label: '钩子句',
    badgeType: 'hook',
    contentLabel: '钩子句内容',
    color: 'pink',
    icon: '🎣',
  },
  value_reconstruction: {
    label: '价值重构',
    badgeType: 'value',
    contentLabel: '价值重构内容',
    color: 'emerald',
    icon: '🔄',
  },
  // 旧素材类型
  story: {
    label: '故事素材',
    badgeType: 'story',
    contentLabel: '故事内容',
    color: 'green',
    icon: '📖',
  },
  quote: {
    label: '引用素材',
    badgeType: 'golden',
    contentLabel: '引用内容',
    color: 'yellow',
    icon: '💬',
  },
  opening: {
    label: '开头素材',
    badgeType: 'story',
    contentLabel: '开头内容',
    color: 'green',
    icon: '🚀',
  },
  ending: {
    label: '结尾素材',
    badgeType: 'story',
    contentLabel: '结尾内容',
    color: 'green',
    icon: '🎯',
  },
};

/** 场景类型中文映射 */
export const SCENE_TYPE_LABELS: Record<string, string> = {
  opening_case: '开头案例',
  benefit_comparison: '收益对比',
  claim_dispute: '理赔纠纷',
  pitfall_warning: '避坑警示',
  product_analysis: '产品分析',
  knowledge_popularization: '科普知识',
  data_support: '数据支撑',
  emotional_resonance: '情感共鸣',
  closing_summary: '结尾总结',
};

/** 所有7维关系型素材类型（含补充类型） */
const RELATIONAL_MATERIAL_TYPES = [
  'misconception', 'analogy', 'case', 'data',
  'golden_sentence', 'fixed_phrase', 'personal_fragment',
  'hook_sentence', 'value_reconstruction',
];

/** 从 material_library 记录提取可读标题 */
export function extractReadableTitle(material: {
  title?: string;
  type?: string;
  content?: string;
}): string {
  const { title, type, content } = material;

  // 如果标题有效（不是占位符格式），直接返回
  if (title && !title.match(/^\[提取\]/) && !title.match(/ - \?$/)) {
    return title;
  }

  // 根据 type 生成前缀
  const config = MATERIAL_TYPE_CONFIG[type || ''];
  const typePrefix = config ? config.label : '素材';

  // 尝试从 content 提取标题
  if (content) {
    // 去除可能的 HTML 标签
    const plainContent = content.replace(/<[^>]*>/g, '').trim();
    // 取第一行或前30字作为标题
    const firstLine = plainContent.split('\n')[0].trim();
    if (firstLine && firstLine.length > 0) {
      // 如果第一行就是标题格式（如"错误认知：XXX"），直接用
      const colonIdx = firstLine.indexOf('：');
      if (colonIdx > 0 && colonIdx < 10) {
        return firstLine.substring(colonIdx + 1).trim().slice(0, 40) || firstLine.slice(0, 40);
      }
      return firstLine.length > 40 ? firstLine.slice(0, 40) + '...' : firstLine;
    }
  }

  return `${typePrefix}素材`;
}

/** 从 content 中解析结构化字段（旧格式兼容） */
function parseStructuredContent(content: string): {
  eventFullStory?: string;
  protagonist?: string;
  background?: string;
  insuranceAction?: string;
  result?: string;
} {
  const result: Record<string, string> = {};

  const fieldMap: Record<string, string> = {
    '【事件经过】': 'eventFullStory',
    '【核心背景】': 'background',
    '【当事人】': 'protagonist',
    '【保险动作】': 'insuranceAction',
    '【最终结果】': 'result',
  };

  for (const [marker, field] of Object.entries(fieldMap)) {
    const startIdx = content.indexOf(marker);
    if (startIdx >= 0) {
      const afterMarker = content.substring(startIdx + marker.length).trim();
      // 找到下一个【】标记或到末尾
      const nextMarker = content.indexOf('【', startIdx + marker.length);
      const value = nextMarker > 0
        ? content.substring(startIdx + marker.length, nextMarker).trim()
        : afterMarker.split('\n')[0].trim();
      if (value) result[field] = value;
    }
  }

  return result;
}

/** 判断是否为7维关系型素材类型 */
export function is7DMaterialType(type: string): boolean {
  return RELATIONAL_MATERIAL_TYPES.includes(type);
}

/** 判断内容是否为旧格式结构化案例 */
function isStructuredContent(content: string): boolean {
  return content.includes('【事件经过】') || content.includes('【核心背景】');
}

/**
 * 素材数据库记录的输入类型
 * 使用宽松类型以兼容 Drizzle ORM select() 返回的严格类型（字段均为 non-nullable）
 * 以及其他查询返回的 nullable 字段
 */
export type MaterialRecord = Record<string, any>;

/** 格式化素材为前端 MaterialItem 格式 */
export function formatMaterialAsItem(material: MaterialRecord): Record<string, any> {
  const materialType = material.type || 'story';
  const config = MATERIAL_TYPE_CONFIG[materialType as string] || MATERIAL_TYPE_CONFIG.story!;
  const typeLabel = config.label;
  const badgeType = config.badgeType;
  const contentLabel = config.contentLabel;

  // 提取可读标题
  const readableTitle = extractReadableTitle(material);

  // 解析内容
  const content = material.content || '';
  const hasStructured = isStructuredContent(content as string);
  const structured = hasStructured ? parseStructuredContent(content as string) : {};

  // 场景描述
  const sceneDesc = SCENE_TYPE_LABELS[material.sceneType || ''] || material.sceneType || '';

  // 产品标签和人群标签
  const productTags = Array.isArray(material.topicTags) ? material.topicTags : [];
  const crowdTags = Array.isArray(material.crowdTags) ? material.crowdTags : [];

  // 内容字段填充策略：区分7维关系型素材 vs 结构化案例
  let eventFullStory = '';
  let background = '';
  let protagonist = '';
  let insuranceAction = '';
  let resultText = '';

  if (is7DMaterialType(materialType as string) && !hasStructured) {
    // 7维关系型素材（非结构化格式）：content 是纯文本，直接使用
    eventFullStory = content as string;
    background = content as string;
    resultText = material.analysisText || '';
  } else if (hasStructured) {
    // 旧格式结构化案例：从标记段落提取
    eventFullStory = structured.eventFullStory || (content as string);
    background = structured.background || '';
    protagonist = structured.protagonist || '';
    insuranceAction = structured.insuranceAction || '';
    resultText = structured.result || material.analysisText || '';
  } else {
    // 无结构标记的普通素材
    eventFullStory = content as string;
    background = content as string;
    resultText = material.analysisText || '';
  }

  return {
    id: material.id,
    title: readableTitle,
    type: materialType,
    typeLabel,
    badgeType,
    contentLabel,
    caseType: badgeType, // 向后兼容前端 caseType 字段
    content: content as string, // 原始内容（重要：详情弹窗需要）
    sceneDesc,

    // 内容字段
    eventFullStory,
    protagonist,
    background,
    insuranceAction,
    result: resultText,

    // 标签
    productTags,
    crowdTags,
    topicTags: Array.isArray(material.topicTags) ? material.topicTags : [],
    sceneTags: Array.isArray(material.sceneTags) ? material.sceneTags : [],
    emotionTags: Array.isArray(material.emotionTags) ? material.emotionTags : [],

    // 适用信息
    applicableProducts: Array.isArray(material.applicableProducts) ? material.applicableProducts : productTags,
    applicableScenarios: Array.isArray(material.applicableScenarios) ? material.applicableScenarios : [],

    // 统计
    useCount: material.useCount || 0,
    effectiveCount: material.effectiveCount || 0,
    ineffectiveCount: material.ineffectiveCount || 0,

    // 归属
    ownerType: material.ownerType || 'user',
    sourceType: material.sourceType || 'manual',

    // 范式信息
    paradigmId: material.paradigmId || null,
    paradigmPosition: material.paradigmPosition || null,
    sourceArticleId: material.sourceArticleId || null,
    industry: material.industry || '',
    sceneType: material.sceneType || '',
    relevanceScore: 0,
    productTagMatchCount: 0,
    workspaceId: material.workspaceId,
    createdAt: material.createdAt,
  };
}
