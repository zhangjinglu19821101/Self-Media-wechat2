/**
 * 文章结构配置库
 * 
 * 解决问题：
 * - 7段结构不再硬编码，可配置化
 * - 支持多种预设结构
 * - 支持用户自定义结构
 */

import { StructureTemplate } from './types';

// 🔥 重新导出类型，方便外部使用
export type { StructureTemplate } from './types';

// ============ 预设结构库 ============

/**
 * 用户专属7段结构（微信公众号默认）
 */
export const USER_DEFAULT_7_SECTION_STRUCTURE: StructureTemplate = {
  id: 'user-default-7-section',
  name: '用户专属7段结构',
  description: '用户指定的专属创作结构，确保符合要求',
  sections: [
    {
      id: 'opening-case',
      name: '真实故事/案例开头',
      description: '用真实故事或案例引起共鸣',
      suggestedWordCount: 300,
      requirements: [
        '必须是真实人物/场景',
        '要有情绪张力',
        '铺垫主题冲突',
      ],
    },
    {
      id: 'raise-question',
      name: '抛出核心疑问',
      description: '提出读者最关心的问题',
      suggestedWordCount: 150,
      requirements: [
        '提出3个核心问题',
        '引发读者思考',
        '关联案例痛点',
      ],
    },
    {
      id: 'emotional-position',
      name: '情绪/立场表达',
      description: '站在消费者立场表达共情',
      suggestedWordCount: 150,
      requirements: [
        '表达共情/不平/惋惜',
        '站在消费者立场',
        '建立信任感',
      ],
    },
    {
      id: 'rational-analysis',
      name: '理性拆解真相',
      description: '理性拆解保险真相',
      suggestedWordCount: 400,
      requirements: [
        '纠正保险误区',
        '专业理性解读',
        '逻辑清晰有条理',
      ],
    },
    {
      id: 'data-support',
      name: '权威数据/规则支撑',
      description: '用数据和规则支撑观点',
      suggestedWordCount: 300,
      requirements: [
        '引用权威数据',
        '引用监管规则',
        '增强可信度',
      ],
    },
    {
      id: 'practical-advice',
      name: '可落地的避坑建议',
      description: '给普通人可操作的建议',
      suggestedWordCount: 300,
      requirements: [
        '具体可操作',
        '实用性强',
        '适合普通人',
      ],
    },
    {
      id: 'conclusion-interaction',
      name: '结尾互动+合规声明',
      description: '引导互动+合规声明',
      suggestedWordCount: 200,
      requirements: [
        '引导互动讨论',
        '合规声明',
        '留下记忆点',
      ],
    },
  ],
  isFixed: true,
  isUserExclusive: true,
  totalSuggestedWordCount: 1800,
};

/**
 * 深度分析型8段结构
 */
export const DEEP_ANALYSIS_8_SECTION_STRUCTURE: StructureTemplate = {
  id: 'deep-analysis-8-section',
  name: '深度分析型8段结构',
  description: '适合专业深度分析文章，更详细的结构',
  sections: [
    {
      id: 'hook',
      name: '钩子开头',
      description: '用震撼数据或观点抓住眼球',
      suggestedWordCount: 150,
      requirements: ['数据震撼', '观点独特', '立即吸引'],
    },
    {
      id: 'background',
      name: '背景铺垫',
      description: '介绍行业背景和现状',
      suggestedWordCount: 200,
      requirements: ['客观描述', '数据支撑', '现状清晰'],
    },
    {
      id: 'problem-statement',
      name: '问题提出',
      description: '明确指出核心问题',
      suggestedWordCount: 200,
      requirements: ['问题明确', '痛点突出', '共鸣强烈'],
    },
    {
      id: 'case-study',
      name: '案例分析',
      description: '真实案例深度分析',
      suggestedWordCount: 400,
      requirements: ['案例真实', '分析深入', '细节具体'],
    },
    {
      id: 'expert-opinion',
      name: '专家观点',
      description: '引用专家或权威观点',
      suggestedWordCount: 250,
      requirements: ['权威引用', '观点有力', '可信度高'],
    },
    {
      id: 'data-analysis',
      name: '数据分析',
      description: '深入分析相关数据',
      suggestedWordCount: 300,
      requirements: ['数据详细', '分析透彻', '图表建议'],
    },
    {
      id: 'solutions',
      name: '解决方案',
      description: '给出具体解决方案',
      suggestedWordCount: 350,
      requirements: ['方案具体', '可操作性强', '分点清晰'],
    },
    {
      id: 'conclusion',
      name: '总结展望',
      description: '总结全文并展望未来',
      suggestedWordCount: 150,
      requirements: ['总结到位', '展望积极', '记忆深刻'],
    },
  ],
  isFixed: false,
  isUserExclusive: false,
  totalSuggestedWordCount: 2000,
};

/**
 * 快速阅读型5段结构
 */
export const QUICK_READ_5_SECTION_STRUCTURE: StructureTemplate = {
  id: 'quick-read-5-section',
  name: '快速阅读型5段结构',
  description: '适合手机端快速阅读，节奏紧凑',
  sections: [
    {
      id: 'direct-opening',
      name: '直接点题',
      description: '开门见山，直接点题',
      suggestedWordCount: 100,
      requirements: ['直接明了', '不绕弯子', '立即点题'],
    },
    {
      id: 'core-issue',
      name: '核心问题',
      description: '直接说核心问题',
      suggestedWordCount: 250,
      requirements: ['问题聚焦', '不发散', '直击要害'],
    },
    {
      id: 'key-insights',
      name: '核心观点',
      description: '3个核心观点',
      suggestedWordCount: 400,
      requirements: ['观点鲜明', '分点清晰', '每条精炼'],
    },
    {
      id: 'action-steps',
      name: '行动建议',
      description: '具体行动建议',
      suggestedWordCount: 250,
      requirements: ['可操作性强', '步骤清晰', '立即可用'],
    },
    {
      id: 'quick-conclusion',
      name: '简短总结',
      description: '简短总结收尾',
      suggestedWordCount: 100,
      requirements: ['简短有力', '记忆点强', '鼓励互动'],
    },
  ],
  isFixed: false,
  isUserExclusive: false,
  totalSuggestedWordCount: 1100,
};

/**
 * 故事驱动型6段结构
 */
export const STORY_DRIVEN_6_SECTION_STRUCTURE: StructureTemplate = {
  id: 'story-driven-6-section',
  name: '故事驱动型6段结构',
  description: '以故事贯穿全文，情感共鸣强',
  sections: [
    {
      id: 'story-opening',
      name: '故事开篇',
      description: '一个引人入胜的故事',
      suggestedWordCount: 350,
      requirements: ['故事性强', '人物鲜活', '有悬念'],
    },
    {
      id: 'turning-point',
      name: '转折点',
      description: '故事的转折点',
      suggestedWordCount: 250,
      requirements: ['转折自然', '出人意料', '引发思考'],
    },
    {
      id: 'lesson-learned',
      name: '经验教训',
      description: '从故事中学到的',
      suggestedWordCount: 300,
      requirements: ['提炼到位', '启发性强', '联系实际'],
    },
    {
      id: 'generalization',
      name: '普遍意义',
      description: '扩展到普遍情况',
      suggestedWordCount: 300,
      requirements: ['引申自然', '覆盖面广', '有代表性'],
    },
    {
      id: 'practical-tips',
      name: '实用建议',
      description: '读者可以怎么做',
      suggestedWordCount: 250,
      requirements: ['建议具体', '可操作性强', '易于理解'],
    },
    {
      id: 'story-ending',
      name: '故事收尾',
      description: '回到故事，温暖收尾',
      suggestedWordCount: 150,
      requirements: ['呼应开头', '情感温暖', '留有回味'],
    },
  ],
  isFixed: false,
  isUserExclusive: false,
  totalSuggestedWordCount: 1600,
};

// ============ 结构库管理 ============

/**
 * 所有预设结构
 */
export const STRUCTURE_TEMPLATES: StructureTemplate[] = [
  USER_DEFAULT_7_SECTION_STRUCTURE,
  DEEP_ANALYSIS_8_SECTION_STRUCTURE,
  QUICK_READ_5_SECTION_STRUCTURE,
  STORY_DRIVEN_6_SECTION_STRUCTURE,
];

/**
 * 获取默认结构（用户专属7段结构）
 */
export function getDefaultStructure(): StructureTemplate {
  return USER_DEFAULT_7_SECTION_STRUCTURE;
}

/**
 * 根据ID获取结构
 */
export function getStructureById(id: string): StructureTemplate | undefined {
  return STRUCTURE_TEMPLATES.find(template => template.id === id);
}

/**
 * 获取用户专属结构（过滤出用户专属）
 */
export function getUserExclusiveStructures(): StructureTemplate[] {
  return STRUCTURE_TEMPLATES.filter(template => template.isUserExclusive);
}

/**
 * 获取所有可选结构（排除固定的用户专属）
 */
export function getSelectableStructures(): StructureTemplate[] {
  return STRUCTURE_TEMPLATES.filter(template => !template.isFixed);
}

/**
 * 结构推荐（根据文章类型推荐）
 * 
 * [M3修复] 文章类型优先于字数条件
 * - 文章类型决定结构风格
 * - 字数条件仅在未指定文章类型时作为参考
 */
export type ArticleType = 'insurance' | 'finance' | 'lifestyle' | 'education';

export function recommendStructure(
  articleType: ArticleType,
  targetWordCount?: number
): StructureTemplate {
  // 文章类型优先
  switch (articleType) {
    case 'insurance':
      // 保险类始终使用用户专属7段结构
      return USER_DEFAULT_7_SECTION_STRUCTURE;
    case 'finance':
      // 金融类推荐深度分析8段，但如果字数较少则降级
      if (targetWordCount && targetWordCount <= 1200) {
        return QUICK_READ_5_SECTION_STRUCTURE;
      }
      return DEEP_ANALYSIS_8_SECTION_STRUCTURE;
    case 'lifestyle':
      // 生活类推荐故事驱动6段
      return STORY_DRIVEN_6_SECTION_STRUCTURE;
    case 'education':
      // 教育类推荐快速阅读5段
      return QUICK_READ_5_SECTION_STRUCTURE;
    default:
      // 未指定类型时，根据字数推荐
      if (targetWordCount) {
        if (targetWordCount <= 1200) return QUICK_READ_5_SECTION_STRUCTURE;
        if (targetWordCount >= 2000) return DEEP_ANALYSIS_8_SECTION_STRUCTURE;
      }
      return USER_DEFAULT_7_SECTION_STRUCTURE;
  }
}

/**
 * 计算结构的总建议字数
 */
export function calculateTotalWordCount(structure: StructureTemplate): number {
  return structure.sections.reduce(
    (total, section) => total + section.suggestedWordCount,
    0
  );
}

/**
 * 验证结构是否有效
 */
export function validateStructure(structure: StructureTemplate): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!structure.id || structure.id.trim() === '') {
    errors.push('结构ID不能为空');
  }

  if (!structure.name || structure.name.trim() === '') {
    errors.push('结构名称不能为空');
  }

  if (!structure.sections || structure.sections.length === 0) {
    errors.push('结构至少需要一个段落');
  }

  structure.sections.forEach((section, index) => {
    if (!section.id || section.id.trim() === '') {
      errors.push(`段落 ${index + 1} 的ID不能为空`);
    }
    if (!section.name || section.name.trim() === '') {
      errors.push(`段落 ${index + 1} 的名称不能为空`);
    }
    if (section.suggestedWordCount <= 0) {
      errors.push(`段落 ${index + 1} 的建议字数必须大于0`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
