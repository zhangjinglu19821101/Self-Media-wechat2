/**
 * 文章结构模板配置
 * 对应文档：docs/重要-素材-类比详细设计方案.md Phase 2
 * 
 * 每种创作类型对应一个结构模板，定义文章的段落组成。
 * 长短文通过篇幅合并规则自动调整。
 */

// ==================== 结构模板定义 ====================

export interface StructureSection {
  /** 段落标识 */
  id: string;
  /** 段落标题模板 */
  titleTemplate: string;
  /** 内容要求 */
  contentRequirement: string;
  /** 字数范围（中篇） */
  wordRange: { min: number; max: number };
  /** 是否必选 */
  required: boolean;
  /** 排序权重 */
  order: number;
}

export interface ArticleStructureTemplate {
  /** 模板ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 适用的创作类型 */
  articleType: string;
  /** 段落列表（按 order 排序） */
  sections: StructureSection[];
  /** 篇幅合并规则 */
  lengthMergeRules: {
    /** 短文合并策略：哪些段落合并 */
    short: string[][];
    /** 长文展开策略：哪些段落拆分 */
    long: string[][];
  };
}

// ==================== 避坑指南模板 ====================

const MYTH_BUSTING_TEMPLATE: ArticleStructureTemplate = {
  id: 'myth_busting',
  name: '避坑指南',
  articleType: 'pitfall_guide',
  sections: [
    { id: 'hook', titleTemplate: '开头引入：用数据/现象引出误区', contentRequirement: '用1个数据或真实场景引出"很多人这样认为"的现象，制造悬念', wordRange: { min: 100, max: 200 }, required: true, order: 1 },
    { id: 'myth', titleTemplate: '误区拆解：揭示错误认知', contentRequirement: '清楚描述常见误区是什么，为什么大家会这样想', wordRange: { min: 200, max: 400 }, required: true, order: 2 },
    { id: 'analogy', titleTemplate: '类比映射：用类比纠正认知', contentRequirement: '用日常类比或跨领域类比，帮助读者从熟悉场景理解正确逻辑', wordRange: { min: 200, max: 400 }, required: true, order: 3 },
    { id: 'truth', titleTemplate: '真相揭示：正确认知+数据支撑', contentRequirement: '用数据和事实支撑正确认知，引用权威来源', wordRange: { min: 200, max: 400 }, required: true, order: 4 },
    { id: 'action', titleTemplate: '行动建议：具体怎么做', contentRequirement: '给出可操作的行动步骤，3-5条建议', wordRange: { min: 150, max: 300 }, required: true, order: 5 },
    { id: 'closing', titleTemplate: '结尾收束：一句话总结+引发思考', contentRequirement: '用一句话总结核心观点，留下思考空间', wordRange: { min: 50, max: 150 }, required: true, order: 6 },
  ],
  lengthMergeRules: {
    short: [['hook', 'myth'], ['analogy', 'truth'], ['action', 'closing']],
    long: [],
  },
};

// ==================== 权威解读模板 ====================

const REGULATION_INTERPRETATION_TEMPLATE: ArticleStructureTemplate = {
  id: 'regulation_interpretation',
  name: '权威解读',
  articleType: 'authority_analysis',
  sections: [
    { id: 'news_hook', titleTemplate: '新闻由头：近期政策/事件引入', contentRequirement: '用1个近期政策或行业事件引入，引出解读必要性', wordRange: { min: 100, max: 200 }, required: true, order: 1 },
    { id: 'regulation_basis', titleTemplate: '法规原文：核心条款引用', contentRequirement: '引用法规原文关键条款，标注出处和生效时间', wordRange: { min: 150, max: 300 }, required: true, order: 2 },
    { id: 'plain_explain', titleTemplate: '通俗解读：条款含义翻译', contentRequirement: '将法律语言翻译为普通人能理解的话，逐条解读', wordRange: { min: 300, max: 500 }, required: true, order: 3 },
    { id: 'impact', titleTemplate: '影响分析：对消费者的实际影响', contentRequirement: '分析法规对普通消费者的影响，谁受益、谁受影响', wordRange: { min: 200, max: 400 }, required: true, order: 4 },
    { id: 'case_verify', titleTemplate: '案例印证：真实案例佐证', contentRequirement: '用真实理赔案例或行业数据佐证解读观点', wordRange: { min: 150, max: 300 }, required: false, order: 5 },
    { id: 'advice', titleTemplate: '实用建议：消费者应对指南', contentRequirement: '给出3-5条消费者可操作的建议', wordRange: { min: 150, max: 300 }, required: true, order: 6 },
  ],
  lengthMergeRules: {
    short: [['news_hook', 'regulation_basis'], ['plain_explain', 'impact'], ['case_verify', 'advice']],
    long: [['plain_explain', 'plain_explain_detail']],
  },
};

// ==================== 故事驱动模板 ====================

const EVENT_ANALOGY_TEMPLATE: ArticleStructureTemplate = {
  id: 'event_analogy',
  name: '故事驱动',
  articleType: 'story_driven',
  sections: [
    { id: 'story_open', titleTemplate: '故事开场：真实事件叙述', contentRequirement: '以真实事件开场，交代时间、人物、经过，制造情感共鸣', wordRange: { min: 200, max: 400 }, required: true, order: 1 },
    { id: 'turning_point', titleTemplate: '转折揭示：事件中的保险关键点', contentRequirement: '指出事件中的保险相关转折点，引发读者思考', wordRange: { min: 150, max: 300 }, required: true, order: 2 },
    { id: 'analogy_bridge', titleTemplate: '类比桥梁：用类比帮助理解', contentRequirement: '用日常生活类比帮助读者理解保险概念', wordRange: { min: 200, max: 400 }, required: true, order: 3 },
    { id: 'knowledge', titleTemplate: '知识展开：保险知识点详解', contentRequirement: '结合事件展开相关保险知识，用数据支撑', wordRange: { min: 200, max: 400 }, required: true, order: 4 },
    { id: 'takeaway', titleTemplate: '启示总结：给读者的实用建议', contentRequirement: '从故事中提炼实用建议，3-5条行动指南', wordRange: { min: 150, max: 300 }, required: true, order: 5 },
  ],
  lengthMergeRules: {
    short: [['story_open', 'turning_point'], ['analogy_bridge', 'knowledge'], ['takeaway']],
    long: [['story_open', 'story_open_detail']],
  },
};

// ==================== 自由创作模板 ====================

const FREE_TEMPLATE: ArticleStructureTemplate = {
  id: 'free',
  name: '自由创作',
  articleType: 'free_creation',
  sections: [
    { id: 'opening', titleTemplate: '开篇引入', contentRequirement: '自由发挥，吸引读者注意', wordRange: { min: 100, max: 300 }, required: true, order: 1 },
    { id: 'body', titleTemplate: '主体内容', contentRequirement: '自由展开论述', wordRange: { min: 500, max: 2000 }, required: true, order: 2 },
    { id: 'closing', titleTemplate: '结尾', contentRequirement: '总结或号召行动', wordRange: { min: 50, max: 200 }, required: true, order: 3 },
  ],
  lengthMergeRules: {
    short: [['opening', 'body'], ['closing']],
    long: [],
  },
};

// ==================== 产品测评模板（Phase 2） ====================

const PRODUCT_EVALUATION_TEMPLATE: ArticleStructureTemplate = {
  id: 'product_evaluation',
  name: '产品测评',
  articleType: 'product_eval',
  sections: [
    { id: 'eval_intro', titleTemplate: '测评背景：为什么测这几款产品', contentRequirement: '说明测评背景、目标人群、选品理由，1-2句话概括测评结论', wordRange: { min: 150, max: 300 }, required: true, order: 1 },
    { id: 'product_overview', titleTemplate: '产品概览：基本信息对比', contentRequirement: '用表格或列表展示产品基本信息（公司/产品名/类型/保费范围）', wordRange: { min: 200, max: 400 }, required: true, order: 2 },
    { id: 'dimension_analysis', titleTemplate: '维度测评：逐维度对比分析', contentRequirement: '按测评维度（保障范围/保费/免责条款/理赔条件等）逐项对比，给出优劣势', wordRange: { min: 400, max: 800 }, required: true, order: 3 },
    { id: 'highlight_risk', titleTemplate: '亮点与坑点：值得关注的细节', contentRequirement: '重点突出产品亮点和隐藏坑点，用类比帮助理解复杂条款', wordRange: { min: 200, max: 400 }, required: true, order: 4 },
    { id: 'crowd_recommend', titleTemplate: '人群推荐：不同人群怎么选', contentRequirement: '按目标人群画像给出推荐方案，说明推荐理由', wordRange: { min: 200, max: 400 }, required: true, order: 5 },
    { id: 'summary', titleTemplate: '测评总结：一句话推荐', contentRequirement: '用一句话总结推荐产品，附注意事项', wordRange: { min: 100, max: 200 }, required: true, order: 6 },
  ],
  lengthMergeRules: {
    short: [['eval_intro', 'product_overview'], ['dimension_analysis', 'highlight_risk'], ['crowd_recommend', 'summary']],
    long: [['dimension_analysis', 'dimension_detail']],
  },
};

// ==================== 投保指南模板（Phase 2） ====================

const INSURANCE_GUIDE_TEMPLATE: ArticleStructureTemplate = {
  id: 'insurance_guide',
  name: '投保指南',
  articleType: 'insurance_guide',
  sections: [
    { id: 'persona', titleTemplate: '人群画像：你属于哪类人', contentRequirement: '描述目标人群的特征（年龄/收入/家庭结构），建立"说的是我"的代入感', wordRange: { min: 150, max: 300 }, required: true, order: 1 },
    { id: 'need_analysis', titleTemplate: '需求分析：你最需要什么保障', contentRequirement: '分析目标人群的核心风险和保障缺口，用数据或案例佐证', wordRange: { min: 200, max: 400 }, required: true, order: 2 },
    { id: 'plan_recommend', titleTemplate: '方案推荐：量身定制的投保方案', contentRequirement: '给出具体保险方案（险种+保额+保费），说明推荐理由', wordRange: { min: 300, max: 600 }, required: true, order: 3 },
    { id: 'pitfall_avoid', titleTemplate: '避坑指南：这些误区要避开', contentRequirement: '列出该人群常见的投保误区，用类比帮助理解', wordRange: { min: 200, max: 400 }, required: false, order: 4 },
    { id: 'budget_optimize', titleTemplate: '预算优化：怎么买最划算', contentRequirement: '提供预算分配建议，如何在有限预算内最大化保障', wordRange: { min: 200, max: 400 }, required: true, order: 5 },
    { id: 'action_checklist', titleTemplate: '行动清单：投保前必查事项', contentRequirement: '提供投保前检查清单（健康告知/受益人/等待期等）', wordRange: { min: 150, max: 300 }, required: true, order: 6 },
  ],
  lengthMergeRules: {
    short: [['persona', 'need_analysis'], ['plan_recommend', 'pitfall_avoid'], ['budget_optimize', 'action_checklist']],
    long: [['plan_recommend', 'plan_detail']],
  },
};

// ==================== 模板注册表 ====================

export const ARTICLE_STRUCTURE_TEMPLATES: Record<string, ArticleStructureTemplate> = {
  myth_busting: MYTH_BUSTING_TEMPLATE,
  regulation_interpretation: REGULATION_INTERPRETATION_TEMPLATE,
  event_analogy: EVENT_ANALOGY_TEMPLATE,
  free: FREE_TEMPLATE,
  product_evaluation: PRODUCT_EVALUATION_TEMPLATE,
  insurance_guide: INSURANCE_GUIDE_TEMPLATE,
};

// ==================== 篇幅调整方法 ====================

/**
 * 根据篇幅合并规则调整结构模板
 * @param templateId 模板ID
 * @param articleLength 篇幅类型
 * @returns 调整后的段落列表
 */
export function getAdjustedSections(
  templateId: string,
  articleLength?: 'short' | 'medium' | 'long'
): StructureSection[] {
  const template = ARTICLE_STRUCTURE_TEMPLATES[templateId];
  if (!template) return [];

  const sections = [...template.sections].sort((a, b) => a.order - b.order);

  // 中篇直接返回原始模板
  if (!articleLength || articleLength === 'medium') {
    return sections;
  }

  if (articleLength === 'short') {
    // 短文：按合并规则合并段落
    const mergeGroups = template.lengthMergeRules.short;
    if (mergeGroups.length === 0) {
      // 没有合并规则，返回原始段落但缩减字数
      return sections.map(s => ({
        ...s,
        wordRange: { min: Math.round(s.wordRange.min * 0.6), max: Math.round(s.wordRange.max * 0.6) },
      }));
    }

    const mergedSections: StructureSection[] = [];
    const mergedIds = new Set(mergeGroups.flat());

    // 先处理合并的段落
    for (const group of mergeGroups) {
      const groupSections = sections.filter(s => group.includes(s.id));
      if (groupSections.length > 0) {
        mergedSections.push({
          id: group.join('_'),
          titleTemplate: groupSections.map(s => s.titleTemplate.split('：')[0]).join(' + '),
          contentRequirement: groupSections.map(s => s.contentRequirement).join('；'),
          wordRange: {
            min: Math.round(groupSections.reduce((sum, s) => sum + s.wordRange.min, 0) * 0.7),
            max: Math.round(groupSections.reduce((sum, s) => sum + s.wordRange.max, 0) * 0.7),
          },
          required: groupSections.some(s => s.required),
          order: Math.min(...groupSections.map(s => s.order)),
        });
      }
    }

    // 再添加未合并的段落
    for (const section of sections) {
      if (!mergedIds.has(section.id)) {
        mergedSections.push({
          ...section,
          wordRange: { min: Math.round(section.wordRange.min * 0.6), max: Math.round(section.wordRange.max * 0.6) },
        });
      }
    }

    return mergedSections.sort((a, b) => a.order - b.order);
  }

  // 长文：展开段落（增加详细子段落）
  if (articleLength === 'long') {
    const expandedSections: StructureSection[] = [];
    for (const section of sections) {
      expandedSections.push({
        ...section,
        wordRange: { min: Math.round(section.wordRange.min * 1.3), max: Math.round(section.wordRange.max * 1.5) },
      });
    }
    return expandedSections;
  }

  return sections;
}

/**
 * 格式化结构模板为提示词文本
 * @param templateId 模板ID
 * @param articleLength 篇幅类型
 * @returns 格式化的结构描述文本
 */
export function formatStructureTemplate(
  templateId: string,
  articleLength?: 'short' | 'medium' | 'long'
): string {
  const template = ARTICLE_STRUCTURE_TEMPLATES[templateId];
  if (!template) return '';

  const sections = getAdjustedSections(templateId, articleLength);
  const lengthLabel = articleLength ? { short: '短文', medium: '中篇', long: '长文' }[articleLength] : '中篇';

  let text = `【文章结构模板：${template.name}】（${lengthLabel}模式）\n\n`;
  text += `必须严格按照以下段落结构写作，每段有明确的内容要求和字数范围：\n\n`;

  for (const section of sections) {
    const required = section.required ? '【必写】' : '【选写】';
    text += `${required} 第${section.order}段：${section.titleTemplate}\n`;
    text += `  内容要求：${section.contentRequirement}\n`;
    text += `  字数范围：${section.wordRange.min}-${section.wordRange.max}字\n\n`;
  }

  return text;
}
