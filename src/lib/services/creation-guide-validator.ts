/**
 * 创作引导校验服务
 * 根据创作类型校验素材组合是否满足要求
 * 对应文档：docs/重要-素材-类比详细设计方案.md 第4节 + Phase 2 扩展
 */

import {
  ARTICLE_TYPES,
  SCENE_TYPES,
  type ArticleTypeKey,
  type SceneTypeKey,
  type MaterialValidationResult,
  type ProductEvaluationStructuredData,
  type InsuranceGuideStructuredData,
} from '@/lib/agents/creation-guide-types';

/** 素材条目（简化版，仅含校验所需字段） */
interface MaterialItem {
  id: string;
  sceneType?: string | null;
  type: string;
}

/** 结构化数据校验结果 */
export interface StructuredDataValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 校验素材组合是否满足创作类型要求
 */
export function validateMaterialsForArticleType(
  articleType: ArticleTypeKey,
  materials: MaterialItem[]
): MaterialValidationResult {
  const config = ARTICLE_TYPES[articleType];
  const errors: string[] = [];
  const warnings: string[] = [];

  // 统计各场景类型数量
  const sceneTypeCounts = {} as Record<SceneTypeKey, number>;
  for (const st of Object.keys(SCENE_TYPES) as SceneTypeKey[]) {
    sceneTypeCounts[st] = 0;
  }
  for (const m of materials) {
    if (m.sceneType && m.sceneType in SCENE_TYPES) {
      sceneTypeCounts[m.sceneType as SceneTypeKey]++;
    }
  }

  // 自由创作无硬性要求
  if (articleType === 'free_creation') {
    return {
      isValid: true,
      errors: [],
      warnings: materials.length === 0 ? ['自由创作模式下建议至少选择1条素材'] : [],
      sceneTypeCounts,
      missingRequired: [],
      suggestedOptional: [],
    };
  }

  // 检查必选素材
  const missingRequired: SceneTypeKey[] = [];
  for (const st of config.requiredSceneTypes) {
    const minCount = config.minMaterials[st] ?? 1;
    if (sceneTypeCounts[st] < minCount) {
      missingRequired.push(st);
      errors.push(
        `${SCENE_TYPES[st].label}至少需要${minCount}条，当前${sceneTypeCounts[st]}条`
      );
    }
  }

  // 检查可选素材（仅警告）
  const suggestedOptional: SceneTypeKey[] = [];
  for (const st of config.optionalSceneTypes) {
    if (sceneTypeCounts[st] === 0) {
      suggestedOptional.push(st);
      warnings.push(`建议添加${SCENE_TYPES[st].label}素材，可提升文章说服力`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sceneTypeCounts,
    missingRequired,
    suggestedOptional,
  };
}

/**
 * 校验产品测评结构化数据
 * Phase 2 新增
 */
export function validateProductEvalData(
  data: Partial<ProductEvaluationStructuredData>
): StructuredDataValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data.products || data.products.length === 0) {
    errors.push('产品测评必须选择至少1款测评产品');
  } else if (data.products.length === 1) {
    warnings.push('建议选择2-3款产品进行对比测评，单产品测评说服力有限');
  } else if (data.products.length > 5) {
    warnings.push('测评产品超过5款可能导致篇幅过长，建议控制在3-4款');
  }

  if (!data.dimensions || data.dimensions.length === 0) {
    errors.push('产品测评必须选择至少1个测评维度');
  } else if (data.dimensions.length < 3) {
    warnings.push('建议选择3个以上测评维度，维度太少测评不够全面');
  }

  if (!data.targetAudience || data.targetAudience.trim().length < 2) {
    errors.push('请描述目标人群（如：30-40岁已婚有娃家庭）');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 校验投保指南结构化数据
 * Phase 2 新增
 */
export function validateInsuranceGuideData(
  data: Partial<InsuranceGuideStructuredData>
): StructuredDataValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data.targetGroup || data.targetGroup.trim().length < 2) {
    errors.push('投保指南必须指定目标人群');
  }

  if (!data.coreNeeds || data.coreNeeds.length === 0) {
    errors.push('请选择至少1项核心保障需求');
  } else if (data.coreNeeds.length < 2) {
    warnings.push('建议选择2项以上核心保障需求，方案更全面');
  }

  if (!data.budgetRange || data.budgetRange.trim().length < 2) {
    warnings.push('建议提供预算范围，方便制定方案');
  }

  if (!data.focusPoints || data.focusPoints.length === 0) {
    warnings.push('建议选择关注重点，帮助聚焦方案');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 统一校验入口：根据创作类型校验结构化数据
 */
export function validateStructuredData(
  articleType: ArticleTypeKey,
  structuredData: Record<string, unknown>
): StructuredDataValidationResult {
  if (articleType === 'product_eval') {
    return validateProductEvalData(structuredData as Partial<ProductEvaluationStructuredData>);
  }
  if (articleType === 'insurance_guide') {
    return validateInsuranceGuideData(structuredData as Partial<InsuranceGuideStructuredData>);
  }
  // 其他类型无需结构化数据校验
  return { isValid: true, errors: [], warnings: [] };
}

/**
 * 获取创作类型所需的素材筛选条件
 * 返回 sceneType 列表，用于前端筛选素材
 */
export function getMaterialFilterForArticleType(
  articleType: ArticleTypeKey
): { required: SceneTypeKey[]; optional: SceneTypeKey[] } {
  const config = ARTICLE_TYPES[articleType];
  if (!config) return { required: [], optional: [] };
  return {
    required: [...config.requiredSceneTypes],
    optional: [...config.optionalSceneTypes],
  };
}

/**
 * 计算素材组合的匹配度分数（0-100）
 * 用于前端展示素材选择的完整度
 */
export function calculateMaterialScore(
  articleType: ArticleTypeKey,
  materials: MaterialItem[]
): number {
  const config = ARTICLE_TYPES[articleType];
  if (!config) return 0;

  // 自由创作：有素材即得基础分
  if (articleType === 'free_creation') {
    return materials.length > 0 ? 60 + Math.min(materials.length * 10, 40) : 0;
  }

  let score = 0;
  const totalRequired = config.requiredSceneTypes.length;
  const totalOptional = config.optionalSceneTypes.length;

  // 必选素材占 70 分
  if (totalRequired > 0) {
    let requiredMet = 0;
    for (const st of config.requiredSceneTypes) {
      const minCount = config.minMaterials[st] ?? 1;
      const sceneMaterials = materials.filter(m => m.sceneType === st);
      if (sceneMaterials.length >= minCount) {
        requiredMet++;
      } else if (sceneMaterials.length > 0) {
        requiredMet += 0.5; // 有但不够数量，给一半分
      }
    }
    score += (requiredMet / totalRequired) * 70;
  } else {
    score += 70; // 无必选要求，直接满分
  }

  // 可选素材占 30 分
  if (totalOptional > 0) {
    let optionalMet = 0;
    for (const st of config.optionalSceneTypes) {
      if (materials.some(m => m.sceneType === st)) {
        optionalMet++;
      }
    }
    score += (optionalMet / totalOptional) * 30;
  }

  return Math.round(score);
}
