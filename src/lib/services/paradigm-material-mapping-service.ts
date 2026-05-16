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
 * 5. 【位置ID三重绑定】第一层绑定：范式结构 ↔ slotId
 *    第二层绑定：素材 ↔ slotId（通过material_library.slotId字段）
 *    第三层绑定：匹配规则 ↔ slotId（填充时严格检查ID匹配）
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
 * 位置ID映射结果（位置ID三重绑定-第一层）
 * 每个插入点有唯一的slotId，如 P001-01、P001-02
 */
export interface SlotIdMapping {
  slotId: string;
  paragraphOrder: number;
  stepName: string;
  materialTypes: RelationalMaterialType[];
  isPrimary: boolean;
  isOptional: boolean;
  fixedContext?: string;
}

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
  slotIdMappings: SlotIdMapping[]; // 位置ID三重绑定-第一层
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

  // 构建位置ID映射（位置ID三重绑定-第一层）
  const slotIdMappings: SlotIdMapping[] = [];

  // 遍历 materialPositionMap，统计素材类型使用情况
  for (const position of paradigm.materialPositionMap) {
    // 添加位置ID映射
    if ('slotId' in position) {
      slotIdMappings.push({
        slotId: position.slotId,
        paragraphOrder: position.paragraphOrder,
        stepName: position.stepName,
        materialTypes: position.materialTypes as unknown as RelationalMaterialType[],
        isPrimary: position.isPrimary,
        isOptional: position.isOptional,
        fixedContext: 'fixedContext' in position ? String((position as Record<string, unknown>).fixedContext) : undefined
      });
    }

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
    slotIdMappings, // 位置ID三重绑定-第一层
  };
}

/**
 * 获取所有可用范式的素材映射
 * @returns 所有范式的素材映射
 */
export function getAllParadigmMaterialMappings(): ParadigmMaterialMapping[] {
  return PARADIGM_SEED_DATA
    .filter((p) => p.isActive)
    .map((p) => getParadigmMaterialMapping(p.paradigmCode))
    .filter((m): m is ParadigmMaterialMapping => m !== null);
}

/**
 * 检查素材是否与指定的位置ID匹配（位置ID三重绑定-第二层+第三层）
 * @param materialSlotId 素材的slotId
 * @param targetSlotId 目标位置的slotId
 * @returns 是否匹配
 */
export function isSlotIdMatch(
  materialSlotId: string | null,
  targetSlotId: string
): boolean {
  if (!materialSlotId) {
    return false;
  }
  
  // 严格匹配：只能将同ID素材填充到同ID位置
  return materialSlotId === targetSlotId;
}

/**
 * 获取范式需要的素材类型列表
 * @param paradigmCode 范式代码
 * @returns 需要的素材类型列表
 */
export function getRequiredMaterialTypes(paradigmCode: string): RelationalMaterialType[] {
  const mapping = getParadigmMaterialMapping(paradigmCode);
  if (!mapping) return [];
  return mapping.allMaterialTypes;
}

/**
 * 从范式中获取指定位置的slotId
 * @param paradigmCode 范式代码
 * @param paragraphOrder 段落顺序
 * @returns slotId（如果找到）
 */
export function getSlotIdByParagraph(
  paradigmCode: string,
  paragraphOrder: number
): string | null {
  const mapping = getParadigmMaterialMapping(paradigmCode);
  if (!mapping) return null;

  const slotMapping = mapping.slotIdMappings.find(
    (s) => s.paragraphOrder === paragraphOrder
  );
  
  return slotMapping?.slotId || null;
}

/**
 * 生成填充约束提示词（位置ID三重绑定-第三层）
 * 【绝对禁止规则】：只能将带有「对应位置ID」等于当前占位符ID的素材，填充到该占位符中。
 * 任何情况下，都不允许将素材填充到ID不匹配的占位符中。
 * @param paradigmCode 范式代码
 * @returns 填充约束提示词
 */
export function generateSlotIdConstraintPrompt(paradigmCode: string): string {
  const mapping = getParadigmMaterialMapping(paradigmCode);
  if (!mapping || mapping.slotIdMappings.length === 0) {
    return '';
  }

  const slotIdList = mapping.slotIdMappings
    .map((s) => `- ${s.slotId}: ${s.stepName}（只能插入: ${s.materialTypes.map(t => MATERIAL_TYPE_INFO[t].label).join('、')}）`)
    .join('\n');

  return `
【绝对禁止规则 - 位置ID三重绑定】
只能将带有「对应位置ID」等于当前占位符ID的素材，填充到该占位符中。
任何情况下，都不允许将素材填充到ID不匹配的占位符中。

本范式的位置ID清单：
${slotIdList}

【填充规则】
1. 对于占位符 {{PXXX-YY}}，只能使用 slotId="PXXX-YY" 的素材
2. 素材类型必须与位置要求的类型完全匹配
3. 固定上下文一个字都不能改，只填充素材部分
4. 可选插入点可以选择不插入，但如果插入，必须用对应类型的素材
`;
}

/**
 * 验证素材与位置的匹配性
 * @param material 素材
 * @param slotId 目标位置ID
 * @param materialType 目标素材类型
 * @returns 是否匹配
 */
export function validateMaterialSlotMatch(
  material: { slotId: string | null; type: string },
  slotId: string,
  materialType: RelationalMaterialType
): { valid: boolean; reason?: string } {
  // 第二层绑定：素材 ↔ slotId
  if (!material.slotId) {
    return { valid: false, reason: '素材缺少slotId绑定' };
  }
  
  if (!isSlotIdMatch(material.slotId, slotId)) {
    return { 
      valid: false, 
      reason: `素材slotId(${material.slotId})与目标位置slotId(${slotId})不匹配` 
    };
  }

  // 检查素材类型
  if (material.type !== materialType) {
    return { 
      valid: false, 
      reason: `素材类型(${material.type})与目标位置类型(${materialType})不匹配` 
    };
  }

  return { valid: true };
}
