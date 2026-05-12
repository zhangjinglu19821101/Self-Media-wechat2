/**
 * 素材数据格式化服务
 * 对应文档：docs/重要-素材-类比详细设计方案.md Phase 2
 * 
 * 将素材数据按创作类型格式化为提示词注入文本
 */

import type {
  ArticleTypeKey,
  ProductEvaluationStructuredData,
  InsuranceGuideStructuredData,
} from '@/lib/agents/creation-guide-types';

/** 素材条目（简化版，格式化所需字段） */
interface MaterialItem {
  id: string;
  title: string;
  content: string;
  sceneType?: string | null;
  materialType?: string | null;
}

/**
 * 格式化素材为提示词文本
 * @param articleType 创作类型
 * @param materials 已选素材列表
 * @param structuredData 结构化数据（产品测评/投保指南）
 * @returns 格式化的提示词文本
 */
export function formatMaterialsForPrompt(
  articleType: ArticleTypeKey,
  materials: MaterialItem[],
  structuredData?: Record<string, unknown>
): string {
  if (materials.length === 0 && !structuredData) return '';

  const sections: string[] = [];

  // 1. 格式化结构化数据
  if (structuredData) {
    const structuredText = formatStructuredData(articleType, structuredData);
    if (structuredText) sections.push(structuredText);
  }

  // 2. 按场景类型分组格式化素材
  const groupedMaterials = groupBySceneType(materials);
  for (const [sceneType, items] of Object.entries(groupedMaterials)) {
    const label = getSceneTypeLabel(sceneType);
    const formatted = items.map((m, i) => `[${i + 1}] 【${m.title}】\n${m.content}`).join('\n\n');
    sections.push(`【${label}素材】\n${formatted}`);
  }

  // 3. 组合输出
  const header = `【创作类型: ${getArticleTypeLabel(articleType)} — 素材注入区】`;
  const usageNote = getUsageNote(articleType);

  return `${header}\n${usageNote}\n\n${sections.join('\n\n')}`;
}

/**
 * 格式化结构化数据为提示词文本
 */
function formatStructuredData(
  articleType: ArticleTypeKey,
  structuredData: Record<string, unknown>
): string {
  if (articleType === 'product_eval') {
    return formatProductEvalData(structuredData as unknown as ProductEvaluationStructuredData);
  }
  if (articleType === 'insurance_guide') {
    return formatInsuranceGuideData(structuredData as unknown as InsuranceGuideStructuredData);
  }
  return '';
}

/**
 * 格式化产品测评结构化数据
 */
function formatProductEvalData(data: ProductEvaluationStructuredData): string {
  const lines: string[] = ['【产品测评结构化数据】'];

  if (data.products && data.products.length > 0) {
    lines.push('\n测评产品列表：');
    data.products.forEach((p, i) => {
      lines.push(`  ${i + 1}. ${p.name}（${p.company}，${p.type}）`);
    });
  }

  if (data.dimensions && data.dimensions.length > 0) {
    lines.push(`\n测评维度：${data.dimensions.join(' / ')}`);
  }

  if (data.targetAudience) {
    lines.push(`\n目标人群：${data.targetAudience}`);
  }

  lines.push('\n写作要求：');
  lines.push('- 必须按测评维度逐项对比所有产品');
  lines.push('- 每个维度给出明确结论（推荐/不推荐/看情况）');
  lines.push('- 用表格或结构化方式呈现对比信息');
  lines.push('- 突出产品亮点和隐藏坑点');

  return lines.join('\n');
}

/**
 * 格式化投保指南结构化数据
 */
function formatInsuranceGuideData(data: InsuranceGuideStructuredData): string {
  const lines: string[] = ['【投保指南结构化数据】'];

  lines.push(`\n目标人群：${data.targetGroup}`);

  if (data.coreNeeds && data.coreNeeds.length > 0) {
    lines.push(`\n核心保障需求：${data.coreNeeds.join(' / ')}`);
  }

  if (data.budgetRange) {
    lines.push(`\n预算范围：${data.budgetRange}`);
  }

  if (data.focusPoints && data.focusPoints.length > 0) {
    lines.push(`\n关注重点：${data.focusPoints.join(' / ')}`);
  }

  lines.push('\n写作要求：');
  lines.push('- 必须针对目标人群量身定制方案');
  lines.push('- 给出具体险种+保额+保费数字');
  lines.push('- 解释为什么这样配置（匹配需求）');
  lines.push('- 提供预算优化方案（怎么买最划算）');

  return lines.join('\n');
}

/**
 * 按场景类型分组素材
 */
function groupBySceneType(materials: MaterialItem[]): Record<string, MaterialItem[]> {
  const groups: Record<string, MaterialItem[]> = {};
  for (const m of materials) {
    const st = m.sceneType || 'other';
    if (!groups[st]) groups[st] = [];
    groups[st].push(m);
  }
  return groups;
}

/**
 * 获取创作类型对应的使用说明
 */
function getUsageNote(articleType: ArticleTypeKey): string {
  const notes: Record<ArticleTypeKey, string> = {
    pitfall_guide: '以下素材必须融入文章：误区素材用于"误区拆解"段落，类比素材用于"类比映射"段落',
    authority_analysis: '以下素材必须融入文章：法规素材用于"法规原文"段落，事件素材用于"案例印证"段落',
    story_driven: '以下素材必须融入文章：事件素材用于"故事开场"段落，类比素材用于"类比桥梁"段落',
    free_creation: '以下素材为参考素材，可根据行文需要灵活融入',
    product_eval: '以下素材必须融入文章：产品素材用于"维度测评"段落，类比素材用于"亮点与坑点"段落',
    insurance_guide: '以下素材必须融入文章：法规素材用于"需求分析"和"行动清单"段落，类比素材用于"避坑指南"段落',
  };
  return notes[articleType] || '以下素材请根据行文需要融入文章';
}

/**
 * 获取场景类型中文标签
 */
function getSceneTypeLabel(sceneType: string): string {
  const labels: Record<string, string> = {
    analogy: '类比案例',
    mistake: '常见误区',
    regulation: '法规依据',
    event: '热点事件',
    product: '产品素材',
    other: '其他素材',
  };
  return labels[sceneType] || sceneType;
}

/**
 * 获取创作类型中文标签
 */
function getArticleTypeLabel(articleType: string): string {
  const labels: Record<string, string> = {
    pitfall_guide: '避坑指南',
    authority_analysis: '权威解读',
    story_driven: '故事驱动',
    free_creation: '自由创作',
    product_eval: '产品测评',
    insurance_guide: '投保指南',
  };
  return labels[articleType] || articleType;
}

/**
 * 格式化篇幅要求为提示词文本
 */
export function formatArticleLengthPrompt(articleLength?: 'short' | 'medium' | 'long'): string {
  if (!articleLength) return '';

  const config: Record<string, { label: string; range: string; instruction: string }> = {
    short: {
      label: '短文',
      range: '800-1500字',
      instruction: '精炼表达，合并段落，每段不超过200字，快速切入核心观点',
    },
    medium: {
      label: '中篇',
      range: '1500-3000字',
      instruction: '标准篇幅，每段150-400字，详细但不冗余',
    },
    long: {
      label: '长文',
      range: '3000-5000字',
      instruction: '深度展开，每段200-600字，多角度论述，丰富案例和数据',
    },
  };

  const c = config[articleLength];
  if (!c) return '';

  return `【篇幅要求：${c.label}（${c.range}）】\n${c.instruction}`;
}
