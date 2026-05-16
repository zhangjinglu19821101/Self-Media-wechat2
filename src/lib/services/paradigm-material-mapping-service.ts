import { PARADIGM_SEED_DATA } from "@/lib/db/schema/paradigm-seed-data";
import { RELATIONAL_MATERIAL_TYPES, RelationalMaterialType } from "@/lib/db/schema/article-extractions";

/**
 * 范式-素材维度映射服务
 * 
 * 核心功能：
 * 1. 从范式的 materialPositionMap 中提取该范式需要的所有素材类型
 * 2. 提供范式与素材维度的绑定关系查询
 * 3. 支持按范式查询可选素材维度
 * 4. 提供素材维度的详细信息和推荐
 */

// 素材维度详细信息映射
export const MATERIAL_TYPE_INFO: Record<RelationalMaterialType, {
  label: string;
  description: string;
  icon: string;
  color: string;
  priority: number;
}> = {
  misconception: {
    label: "错误认知",
    description: "常见的错误理解或认知误区",
    icon: "❌",
    color: "text-red-600 bg-red-50 border-red-200",
    priority: 1,
  },
  analogy: {
    label: "生活类比",
    description: "用日常生活场景类比帮助理解",
    icon: "🎯",
    color: "text-blue-600 bg-blue-50 border-blue-200",
    priority: 2,
  },
  case: {
    label: "真实案例",
    description: "真实发生的案例或故事",
    icon: "📋",
    color: "text-green-600 bg-green-50 border-green-200",
    priority: 1,
  },
  data: {
    label: "权威数据",
    description: "官方发布的数据或统计信息",
    icon: "📊",
    color: "text-purple-600 bg-purple-50 border-purple-200",
    priority: 2,
  },
  golden_sentence: {
    label: "金句",
    description: "精炼的金句或总结性语句",
    icon: "💎",
    color: "text-yellow-600 bg-yellow-50 border-yellow-200",
    priority: 3,
  },
  fixed_phrase: {
    label: "固定句式",
    description: "常用的固定表达或句式组合",
    icon: "📝",
    color: "text-gray-600 bg-gray-50 border-gray-200",
    priority: 3,
  },
  personal_fragment: {
    label: "个人碎片",
    description: "个人经历或碎片化素材",
    icon: "✨",
    color: "text-pink-600 bg-pink-50 border-pink-200",
    priority: 3,
  },
};

/**
 * 范式素材映射结果类型
 */
export interface ParadigmMaterialMapping {
  paradigmCode: string;
  paradigmName: string;
  requiredMaterialTypes: RelationalMaterialType[];
  optionalMaterialTypes: RelationalMaterialType[];
  allMaterialTypes: RelationalMaterialType[];
  materialTypeDetails: Array<{
    type: RelationalMaterialType;
    label: string;
    description: string;
    icon: string;
    color: string;
    isRequired: boolean;
    usageCount: number;
    primaryParagraphs: number[];
  }>;
}

/**
 * 从范式中提取素材类型映射
 * @param paradigmCode 范式代码
 * @returns 范式素材映射结果
 */
export function getParadigmMaterialMapping(
  paradigmCode: string
): ParadigmMaterialMapping | null {
  const paradigm = PARADIGM_SEED_DATA.find((p) => p.paradigmCode === paradigmCode);
  
  if (!paradigm || !paradigm.materialPositionMap) {
    return null;
  }

  // 统计每个素材类型的使用情况
  const materialTypeUsage = new Map<
    RelationalMaterialType,
    { count: number; isPrimary: boolean; paragraphs: number[] }
  >();

  // 遍历 materialPositionMap，统计素材类型使用情况
  for (const position of paradigm.materialPositionMap) {
    for (const materialType of position.materialTypes) {
      const typedMaterialType = materialType as RelationalMaterialType;
      const existing = materialTypeUsage.get(typedMaterialType) || {
        count: 0,
        isPrimary: false,
        paragraphs: [],
      };

      materialTypeUsage.set(typedMaterialType, {
        count: existing.count + 1,
        isPrimary: existing.isPrimary || position.isPrimary,
        paragraphs: [...existing.paragraphs, position.paragraphOrder],
      });
    }
  }

  // 构建素材类型详细信息
  const materialTypeDetails: ParadigmMaterialMapping["materialTypeDetails"] = [];
  const requiredMaterialTypes: RelationalMaterialType[] = [];
  const optionalMaterialTypes: RelationalMaterialType[] = [];

  for (const [materialType, usage] of materialTypeUsage) {
    const info = MATERIAL_TYPE_INFO[materialType];
    const isRequired = usage.isPrimary && usage.count >= 2;

    materialTypeDetails.push({
      type: materialType,
      label: info.label,
      description: info.description,
      icon: info.icon,
      color: info.color,
      isRequired,
      usageCount: usage.count,
      primaryParagraphs: usage.paragraphs,
    });

    if (isRequired) {
      requiredMaterialTypes.push(materialType);
    } else {
      optionalMaterialTypes.push(materialType);
    }
  }

  // 按优先级和使用情况排序
  materialTypeDetails.sort((a, b) => {
    // 必需的优先
    if (a.isRequired !== b.isRequired) {
      return a.isRequired ? -1 : 1;
    }
    // 使用次数多的优先
    if (a.usageCount !== b.usageCount) {
      return b.usageCount - a.usageCount;
    }
    // 按优先级排序
    const priorityA = MATERIAL_TYPE_INFO[a.type].priority;
    const priorityB = MATERIAL_TYPE_INFO[b.type].priority;
    return priorityA - priorityB;
  });

  return {
    paradigmCode: paradigm.paradigmCode,
    paradigmName: paradigm.paradigmName,
    requiredMaterialTypes,
    optionalMaterialTypes,
    allMaterialTypes: [...requiredMaterialTypes, ...optionalMaterialTypes],
    materialTypeDetails,
  };
}

/**
 * 获取所有范式的素材映射
 * @returns 所有范式的素材映射
 */
export function getAllParadigmMaterialMappings(): Record<
  string,
  ParadigmMaterialMapping
> {
  const mappings: Record<string, ParadigmMaterialMapping> = {};

  for (const paradigm of PARADIGM_SEED_DATA) {
    const mapping = getParadigmMaterialMapping(paradigm.paradigmCode);
    if (mapping) {
      mappings[paradigm.paradigmCode] = mapping;
    }
  }

  return mappings;
}

/**
 * 获取素材类型的详细信息
 * @param materialType 素材类型
 * @returns 素材类型详细信息
 */
export function getMaterialTypeInfo(materialType: RelationalMaterialType) {
  return MATERIAL_TYPE_INFO[materialType];
}

/**
 * 检查素材类型是否在范式中被使用
 * @param paradigmCode 范式代码
 * @param materialType 素材类型
 * @returns 是否被使用
 */
export function isMaterialTypeUsedInParadigm(
  paradigmCode: string,
  materialType: RelationalMaterialType
): boolean {
  const mapping = getParadigmMaterialMapping(paradigmCode);
  return mapping?.allMaterialTypes.includes(materialType) || false;
}

/**
 * 获取范式的推荐素材类型
 * @param paradigmCode 范式代码
 * @param limit 限制数量
 * @returns 推荐素材类型列表
 */
export function getRecommendedMaterialTypes(
  paradigmCode: string,
  limit: number = 5
): RelationalMaterialType[] {
  const mapping = getParadigmMaterialMapping(paradigmCode);
  
  if (!mapping) {
    return [];
  }

  return mapping.materialTypeDetails
    .slice(0, limit)
    .map((detail) => detail.type);
}

/**
 * 获取范式的必需素材类型
 * @param paradigmCode 范式代码
 * @returns 必需素材类型列表
 */
export function getRequiredMaterialTypes(
  paradigmCode: string
): RelationalMaterialType[] {
  const mapping = getParadigmMaterialMapping(paradigmCode);
  return mapping?.requiredMaterialTypes || [];
}

/**
 * 获取范式的可选素材类型
 * @param paradigmCode 范式代码
 * @returns 可选素材类型列表
 */
export function getOptionalMaterialTypes(
  paradigmCode: string
): RelationalMaterialType[] {
  const mapping = getParadigmMaterialMapping(paradigmCode);
  return mapping?.optionalMaterialTypes || [];
}

export default {
  getParadigmMaterialMapping,
  getAllParadigmMaterialMappings,
  getMaterialTypeInfo,
  isMaterialTypeUsedInParadigm,
  getRecommendedMaterialTypes,
  getRequiredMaterialTypes,
  getOptionalMaterialTypes,
};
