/**
 * 素材-范式映射服务
 * 
 * 核心问题：系统存在两套素材分类体系
 * 1. 旧体系（material_library.type）：case/data/story/quote/opening/ending — 用户可见
 * 2. 新体系（materialPositionMap.materialTypes）：misconception/analogy/case/data/fixed_phrase/golden_sentence/personal_fragment — 范式使用
 * 
 * 本服务建立两层映射：
 * 第一层：旧类型 → 范式类型（类型桥接）
 * 第二层：范式类型 → 范式段落位置（位置匹配）
 * 
 * 三原则：
 * 1. 用户素材优先，系统素材补位
 * 2. 类型桥接，柔性兼容
 * 3. 实时校验，透明反馈
 */

// ============================================================
// 第一层：类型桥接映射表
// ============================================================

/**
 * 旧素材类型（material_library.type）→ 范式素材类型（materialPositionMap.materialTypes）
 * 
 * 设计逻辑：
 * - opening 本质是"开头引入"→ 对应 misconception（引入错误认知）或 case（开篇案例）
 * - ending 本质是"结尾收束"→ 对应 golden_sentence（金句收尾）或 fixed_phrase（固定句式结尾）
 * - story 本质是"叙事素材"→ 对应 case（案例佐证）或 personal_fragment（个人碎片）
 * - quote 本质是"引用"→ 对应 golden_sentence（金句）或 fixed_phrase（固定句式引用）
 * - case/data 在两套体系中一致，无需桥接
 */
export const LEGACY_TO_PARADIGM_TYPE_MAP: Record<string, string[]> = {
  // 精确匹配（两套体系共有）
  'case':   ['case'],
  'data':   ['data'],
  
  // 桥接映射（旧体系→新体系）
  'opening': ['misconception', 'case'],                // 开头素材 → 可引入错误认知或案例
  'ending':  ['golden_sentence', 'fixed_phrase'],      // 结尾素材 → 金句或固定句式
  'story':   ['case', 'personal_fragment'],            // 故事素材 → 案例或个人碎片
  'quote':   ['golden_sentence', 'fixed_phrase'],      // 引用素材 → 金句或固定句式
};

/**
 * 反向映射：范式素材类型 → 旧素材类型（用于前端筛选素材库）
 */
export const PARADIGM_TO_LEGACY_TYPE_MAP: Record<string, string[]> = {
  'misconception':     ['opening', 'case'],          // 错误认知 → 开头素材或案例
  'analogy':           [],                           // 类比 → 无旧体系对应（仅 sceneType 匹配）
  'case':              ['case', 'story'],            // 案例 → 案例或故事
  'data':              ['data'],                     // 数据 → 数据
  'fixed_phrase':      ['quote', 'ending'],          // 固定句式 → 引用或结尾
  'golden_sentence':   ['quote', 'ending'],          // 金句 → 引用或结尾
  'personal_fragment': ['story'],                    // 个人碎片 → 故事
};

/** 范式素材类型 → 中文标签 */
export const PARADIGM_TYPE_LABELS: Record<string, string> = {
  'misconception':     '错误认知',
  'analogy':           '类比',
  'case':              '案例',
  'data':              '数据',
  'fixed_phrase':      '固定句式',
  'golden_sentence':   '金句',
  'personal_fragment': '个人碎片',
};

/** 旧素材类型 → 中文标签 */
export const LEGACY_TYPE_LABELS: Record<string, string> = {
  'case':    '案例',
  'data':    '数据',
  'story':   '故事',
  'quote':   '引用',
  'opening': '开头',
  'ending':  '结尾',
};

// ============================================================
// 类型定义
// ============================================================

/** 匹配状态 */
export type MatchStatus = 'exact' | 'bridged' | 'none';

/** 单个素材的范式映射结果 */
export interface MaterialParadigmMapping {
  materialId: string;
  materialTitle: string;
  materialType: string;           // 旧类型（case/data/story/quote/opening/ending）
  materialSceneType?: string;     // 场景类型（analogy/mistake/regulation/event）
  matchedParadigmTypes: string[]; // 映射到的范式类型列表
  matchStatus: MatchStatus;       // 精确匹配 / 桥接匹配 / 无法匹配
  targetParagraphOrders: number[]; // 可填充的段落序号列表
  score: number;                  // 匹配得分：精确=1.0，桥接=0.7，无法匹配=0
}

/** 范式段落需求 */
export interface ParadigmSlotRequirement {
  paragraphOrder: number;
  stepName: string;
  materialTypes: string[];        // 范式需要的素材类型
  isPrimary: boolean;
  filledByUserMaterial?: MaterialParadigmMapping; // 用户素材填充
  autoMatchCount?: number;        // 自动匹配的素材数量
}

/** 范式素材需求清单 */
export interface ParadigmRequirementList {
  paradigmCode: string;
  paradigmName: string;
  slots: ParadigmSlotRequirement[];
  userMaterialMappings: MaterialParadigmMapping[];
  unmatchedUserMaterials: MaterialParadigmMapping[];
}

// ============================================================
// 第二层：映射函数
// ============================================================

/**
 * 将用户素材的旧类型映射到范式类型
 * 
 * 匹配优先级：
 * 1. sceneType 直接匹配范式类型 → 精确匹配（score=1.0）
 * 2. type 通过桥接表匹配 → 桥接匹配（score=0.7）
 * 3. 无法匹配 → none（score=0）
 */
export function mapMaterialToParadigmTypes(params: {
  materialType: string;       // material_library.type（旧类型）
  materialSceneType?: string; // material_library.sceneType（场景类型）
  paradigmSlotTypes: string[]; // 范式段落的 materialTypes 列表
}): { matchedTypes: string[]; matchStatus: MatchStatus; score: number } {
  const { materialType, materialSceneType, paradigmSlotTypes } = params;
  const matchedTypes: string[] = [];

  // 策略1：sceneType 直接匹配（最高优先级）
  if (materialSceneType) {
    for (const pt of paradigmSlotTypes) {
      if (materialSceneType === pt || 
          (materialSceneType === 'mistake' && pt === 'misconception') ||
          (materialSceneType === 'regulation' && pt === 'data') ||
          (materialSceneType === 'event' && pt === 'case')) {
        if (!matchedTypes.includes(pt)) matchedTypes.push(pt);
      }
    }
    if (matchedTypes.length > 0) {
      return { matchedTypes, matchStatus: 'exact', score: 1.0 };
    }
  }

  // 策略2：旧类型通过桥接表匹配
  const bridgeTypes = LEGACY_TO_PARADIGM_TYPE_MAP[materialType];
  if (bridgeTypes) {
    for (const bt of bridgeTypes) {
      if (paradigmSlotTypes.includes(bt) && !matchedTypes.includes(bt)) {
        matchedTypes.push(bt);
      }
    }
    if (matchedTypes.length > 0) {
      return { matchedTypes, matchStatus: 'bridged', score: 0.7 };
    }
  }

  // 策略3：旧类型与范式类型直接相同（case/data）
  if (paradigmSlotTypes.includes(materialType)) {
    return { matchedTypes: [materialType], matchStatus: 'exact', score: 1.0 };
  }

  return { matchedTypes: [], matchStatus: 'none', score: 0 };
}

/**
 * 计算用户素材在范式中的完整映射
 * 
 * 返回每个用户素材可以填充哪些段落、匹配状态和得分
 */
export function buildUserMaterialMappings(params: {
  userMaterials: Array<{
    id: string;
    title: string;
    type: string;
    sceneType?: string;
  }>;
  paradigmSlots: Array<{
    paragraphOrder: number;
    stepName: string;
    materialTypes: string[];
    isPrimary: boolean;
  }>;
}): MaterialParadigmMapping[] {
  const { userMaterials, paradigmSlots } = params;
  const mappings: MaterialParadigmMapping[] = [];

  for (const material of userMaterials) {
    const targetParagraphOrders: number[] = [];
    const matchedParadigmTypes: string[] = [];
    let bestStatus: MatchStatus = 'none';
    let bestScore = 0;

    for (const slot of paradigmSlots) {
      const result = mapMaterialToParadigmTypes({
        materialType: material.type,
        materialSceneType: material.sceneType,
        paradigmSlotTypes: slot.materialTypes,
      });

      if (result.matchStatus !== 'none') {
        targetParagraphOrders.push(slot.paragraphOrder);
        for (const mt of result.matchedTypes) {
          if (!matchedParadigmTypes.includes(mt)) matchedParadigmTypes.push(mt);
        }
        // 记录最佳匹配状态
        if (result.score > bestScore) {
          bestScore = result.score;
          bestStatus = result.matchStatus;
        }
      }
    }

    mappings.push({
      materialId: material.id,
      materialTitle: material.title,
      materialType: material.type,
      materialSceneType: material.sceneType,
      matchedParadigmTypes,
      matchStatus: bestStatus,
      targetParagraphOrders,
      score: bestScore,
    });
  }

  return mappings;
}

/**
 * 构建完整的范式素材需求清单（含用户素材填充状态）
 * 
 * 核心逻辑：
 * 1. 遍历范式所有槽位
 * 2. 将用户素材按匹配得分优先分配到槽位
 * 3. 每个槽位最多被1个用户素材填充（用户素材优先，系统素材补位）
 * 4. 返回未匹配的用户素材列表（供前端提示）
 */
export function buildParadigmRequirementList(params: {
  paradigmCode: string;
  paradigmName: string;
  paradigmSlots: Array<{
    paragraphOrder: number;
    stepName: string;
    materialTypes: string[];
    isPrimary: boolean;
  }>;
  userMaterials: Array<{
    id: string;
    title: string;
    type: string;
    sceneType?: string;
  }>;
}): ParadigmRequirementList {
  const { paradigmCode, paradigmName, paradigmSlots, userMaterials } = params;

  // 1. 计算所有用户素材的映射
  const allMappings = buildUserMaterialMappings({ userMaterials, paradigmSlots });

  // 2. 按得分降序排序，高分素材优先分配
  const sortedMappings = [...allMappings].sort((a, b) => b.score - a.score);

  // 3. 分配素材到槽位（贪心算法：高分优先，每个槽位最多1个用户素材）
  const filledSlots = new Set<number>();
  const assignedMappings = new Map<number, MaterialParadigmMapping>();

  for (const mapping of sortedMappings) {
    if (mapping.matchStatus === 'none') continue;
    
    // 优先分配到 isPrimary=true 的槽位
    const primaryOrders = paradigmSlots
      .filter(s => s.isPrimary && mapping.targetParagraphOrders.includes(s.paragraphOrder) && !filledSlots.has(s.paragraphOrder))
      .map(s => s.paragraphOrder);
    
    // 其次分配到任意未填充的槽位
    const availableOrders = mapping.targetParagraphOrders.filter(o => !filledSlots.has(o));
    
    const targetOrder = primaryOrders[0] ?? availableOrders[0];
    
    if (targetOrder !== undefined) {
      filledSlots.add(targetOrder);
      assignedMappings.set(targetOrder, { ...mapping, targetParagraphOrders: [targetOrder] });
    }
  }

  // 4. 构建需求清单
  const slots: ParadigmSlotRequirement[] = paradigmSlots.map(slot => ({
    paragraphOrder: slot.paragraphOrder,
    stepName: slot.stepName,
    materialTypes: slot.materialTypes,
    isPrimary: slot.isPrimary,
    filledByUserMaterial: assignedMappings.get(slot.paragraphOrder),
  }));

  // 5. 收集未匹配的用户素材
  const assignedMaterialIds = new Set([...assignedMappings.values()].map(m => m.materialId));
  const unmatchedUserMaterials = allMappings.filter(m => !assignedMaterialIds.has(m.materialId));

  return {
    paradigmCode,
    paradigmName,
    slots,
    userMaterialMappings: [...assignedMappings.values()],
    unmatchedUserMaterials,
  };
}

/**
 * 获取用户素材ID列表中已被范式优先使用的素材ID
 * 用于从 matchMaterials 的自动匹配中排除（避免重复）
 */
export function getUserFilledMaterialIds(requirementList: ParadigmRequirementList): string[] {
  return requirementList.userMaterialMappings.map(m => m.materialId);
}

/**
 * 获取被用户素材填充的段落序号列表
 * 用于自动匹配时跳过这些段落（用户素材优先，系统素材补位）
 */
export function getUserFilledParagraphOrders(requirementList: ParadigmRequirementList): number[] {
  return requirementList.slots
    .filter(s => s.filledByUserMaterial)
    .map(s => s.paragraphOrder);
}

/**
 * 格式化范式需求清单为提示词文本（注入到 insurance-d 提示词中）
 * 
 * 核心目的：让写作 Agent 明确知道：
 * - 哪些段落的素材由用户指定（必须使用）
 * - 哪些段落需要自动匹配（系统补位）
 * - 用户素材应该放在哪个段落的什么位置
 */
export function formatParadigmRequirementForPrompt(requirementList: ParadigmRequirementList): string {
  const lines: string[] = [];
  
  lines.push(`【用户素材与范式融合指令】`);
  lines.push(`当前范式：${requirementList.paradigmName}（${requirementList.paradigmCode}）`);
  lines.push('');

  for (const slot of requirementList.slots) {
    const typeLabels = slot.materialTypes.map(t => PARADIGM_TYPE_LABELS[t] || t).join('/');
    const primaryMark = slot.isPrimary ? '【主槽位】' : '【辅助槽位】';
    
    if (slot.filledByUserMaterial) {
      const m = slot.filledByUserMaterial;
      const statusLabel = m.matchStatus === 'exact' ? '精确匹配' : '桥接匹配';
      lines.push(`段落${slot.paragraphOrder}【${slot.stepName}】${primaryMark} → 🟢 用户指定素材「${m.materialTitle}」（${statusLabel}，类型：${LEGACY_TYPE_LABELS[m.materialType] || m.materialType} → ${typeLabels}）`);
    } else {
      lines.push(`段落${slot.paragraphOrder}【${slot.stepName}】${primaryMark} → ⚪ 需要自动匹配 ${typeLabels} 类型素材`);
    }
  }

  if (requirementList.unmatchedUserMaterials.length > 0) {
    lines.push('');
    lines.push('⚠️ 以下用户素材无法匹配当前范式任何段落，请酌情融入但不强求：');
    for (const m of requirementList.unmatchedUserMaterials) {
      lines.push(`  - 「${m.materialTitle}」（${LEGACY_TYPE_LABELS[m.materialType] || m.materialType}，无对应段落）`);
    }
  }

  lines.push('');
  lines.push('使用规则：');
  lines.push('1. 🟢 用户指定素材：必须使用，且放在对应段落位置');
  lines.push('2. ⚪ 自动匹配素材：由系统从素材库匹配，写入时自动注入');
  lines.push('3. 用户素材优先级 > 系统自动素材，同一段落不重复填充');

  return lines.join('\n');
}
