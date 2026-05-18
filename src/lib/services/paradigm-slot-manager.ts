/**
 * 范式槽位管理服务
 * 
 * 核心职责：
 * 1. 提供标准的范式槽位定义（与 paradigm-seed-data 同步）
 * 2. 校验素材的 slotId 是否属于有效槽位
 * 3. 标准化不同文章提取的素材到统一的 slotId
 * 4. 检测范式缺失的槽位
 * 5. 根据 materialType 反向查找范式槽位（范式-素材绑定约束的核心）
 * 
 * 设计原则：
 * - 一个范式 = 一组固定的槽位（slotId）
 * - 一个槽位 = 一个段落功能（如"错误认知"、"共情接纳"）
 * - 一个槽位 = 一组允许的素材类型（materialTypes）
 * - 素材必须绑定到有效槽位才能在创作时使用
 * - 选定范式后，素材的范围和位置就定了
 */

import { PARADIGM_SEED_DATA } from '@/lib/db/schema/paradigm-seed-data';

// 槽位定义接口
export interface ParadigmSlot {
  slotId: string;           // 唯一槽位ID，如 "P001-01"
  order: number;            // 段落顺序
  stepName: string;         // 步骤名称，如 "错误认知"
  titleTemplate: string;    // 标题模板
  contentRequirement: string; // 内容要求
  wordRange: { min: number; max: number }; // 字数范围
  required: boolean;        // 是否必填
  fixedPhrases: string[];   // 许可句式
  fixedContext: string;     // 上下文模板
}

// 素材位置映射接口（与 paradigm-seed-data 的 materialPositionMap 对应）
export interface MaterialPositionEntry {
  slotId: string;           // 槽位ID
  stepName: string;         // 步骤名称
  materialTypes: string[];  // 该槽位接受的素材类型
  isPrimary: boolean;       // 是否为主要素材槽位
  isOptional: boolean;      // 是否可选
}

// 范式结构定义
export interface ParadigmStructure {
  paradigmCode: string;
  paradigmName: string;
  description: string;
  slots: ParadigmSlot[];
  slotIdSet: Set<string>;   // 快速查找用
  stepNameToSlotId: Map<string, string>; // 步骤名称 → slotId 映射
  materialPositionMap: MaterialPositionEntry[]; // 素材位置映射（核心绑定约束）
  materialTypeToSlots: Map<string, MaterialPositionEntry[]>; // materialType → 槽位列表 反向映射
}

// 范式槽位管理器
class ParadigmSlotManagerClass {
  private paradigmMap: Map<string, ParadigmStructure> = new Map();
  private initialized = false;

  /**
   * 初始化范式结构（懒加载）
   */
  private ensureInitialized(): void {
    if (this.initialized) return;

    for (const paradigm of PARADIGM_SEED_DATA) {
      const slots: ParadigmSlot[] = (paradigm.officialAccountStructure || []).map((s: any) => ({
        slotId: s.slotId,
        order: s.order,
        stepName: s.stepName,
        titleTemplate: s.titleTemplate,
        contentRequirement: s.contentRequirement,
        wordRange: s.wordRange,
        required: s.required,
        fixedPhrases: s.fixedPhrases || [],
        fixedContext: s.fixedContext || '',
      }));

      const slotIdSet = new Set(slots.map(s => s.slotId));
      const stepNameToSlotId = new Map<string, string>();
      
      // 建立步骤名称到 slotId 的映射（支持多种写法）
      for (const slot of slots) {
        // 标准名称
        stepNameToSlotId.set(slot.stepName, slot.slotId);
        // 去掉空格
        stepNameToSlotId.set(slot.stepName.replace(/\s+/g, ''), slot.slotId);
      }

      // 为所有范式添加通用别名（基于7维素材类型名称映射到步骤名称）
      this.addStepNameAliases(paradigm.paradigmCode, slots, stepNameToSlotId);

      // 加载素材位置映射（materialPositionMap → 范式-素材绑定约束的核心数据）
      const materialPositionMap: MaterialPositionEntry[] = 
        (paradigm.materialPositionMap || []).map((m: any) => ({
          slotId: m.slotId,
          stepName: m.stepName,
          materialTypes: m.materialTypes || [],
          isPrimary: m.isPrimary ?? false,
          isOptional: m.isOptional ?? true,
        }));

      // 构建 materialType → 槽位列表 的反向映射
      const materialTypeToSlots = new Map<string, MaterialPositionEntry[]>();
      for (const entry of materialPositionMap) {
        for (const mt of entry.materialTypes) {
          const list = materialTypeToSlots.get(mt) || [];
          list.push(entry);
          materialTypeToSlots.set(mt, list);
        }
      }

      this.paradigmMap.set(paradigm.paradigmCode, {
        paradigmCode: paradigm.paradigmCode,
        paradigmName: paradigm.paradigmName,
        description: paradigm.description,
        slots,
        slotIdSet,
        stepNameToSlotId,
        materialPositionMap,
        materialTypeToSlots,
      });
    }

    this.initialized = true;
    console.log(`[ParadigmSlotManager] 初始化完成，加载 ${this.paradigmMap.size} 套范式，含素材位置映射`);
  }

  /**
   * 为所有范式添加步骤名称别名
   * 核心原则：LLM 提取时可能输出各种变体名称，需要映射到标准 slotId
   */
  private addStepNameAliases(
    paradigmCode: string, 
    slots: ParadigmSlot[], 
    stepNameToSlotId: Map<string, string>
  ): void {
    // 通用别名映射表：7维素材类型的中文名 → 可能对应的步骤名称变体
    // 这些别名覆盖所有10套范式可能出现的步骤名称变体
    const UNIVERSAL_ALIASES: Record<string, string[]> = {
      // misconception (错误认知) 相关
      '错误认知': ['认知错误', '误区引入', '常见误区', '错误观念', '思维误区', '认知偏差'],
      '行业问题': ['行业痛点', '行业乱象', '行业困境', '行业现状'],
      '案例引入': ['案例开头', '案例导入', '故事引入'],
      '概念引入': ['概念介绍', '概念提出', '开篇引入'],
      '事件引入': ['事件导入', '热点引入', '事件开头'],
      '产品引入': ['产品介绍', '产品开头', '产品导入'],
      '经历引入': ['经历开头', '个人引入', '故事导入'],
      '坑位引入': ['坑位开头', '风险引入', '陷阱引入'],
      '对象引入': ['对比引入', '对比对象', '双方引入'],
      '年度回顾': ['年度总结', '年终回顾', '年度开头'],

      // analogy (类比) 相关
      '通俗类比': ['类比', '生活类比', '打比方', '形象类比', '比喻说明'],
      '区分工具与人': ['人机区分', '工具与人', '角色区分'],
      '顺延推演': ['逻辑推演', '顺延发展', '正常推演'],
      '本质拆解': ['核心拆解', '本质分析', '深度拆解'],
      '深度分析': ['深入分析', '深层分析', '深度解读'],
      '产品拆解': ['产品分析', '产品解读', '产品剖析'],
      '遭遇描述': ['困境描述', '经历描述', '遭遇叙述'],
      '坑位详情': ['坑位描述', '风险详情', '陷阱详情'],
      '对比维度': ['对比标准', '对比角度', '比较维度'],
      '关键事件': ['重要事件', '核心事件', '标志性事件'],

      // case (案例) 相关
      '真实案例': ['案例', '案例分析', '实例', '真实事例', '典型案例'],
      '案例反转': ['意外转折', '反转揭示', '结果反转'],
      '案例支撑': ['案例佐证', '事实支撑', '实例佐证'],
      '劣势分析': ['缺点分析', '不足之处', '产品劣势'],
      '解决过程': ['解决方案', '处理过程', '应对方法'],
      '避坑方法': ['规避方法', '防范措施', '应对策略'],
      'A面分析': ['A面解读', '优势面分析', '正面分析'],
      '数据盘点': ['数据回顾', '年度数据', '数据总结'],

      // data (数据) 相关
      '影响分析': ['影响评估', '后果分析', '波及范围'],
      '分析根源': ['根源分析', '深层原因', '原因剖析'],
      '误导分析': ['误导解读', '误导揭示', '归谬分析'],

      // golden_sentence (金句) 相关
      '反问升华': ['反问', '升华', '质问升华', '灵魂追问'],
      '价值重构': ['收尾', '总结', '金句收尾', '价值升华', '观点升华'],
      '金句收尾': ['金句结尾', '金句总结', '价值收尾'],
      '总结提炼': ['提炼总结', '核心提炼', '观点提炼'],
      '警示收尾': ['警醒收尾', '警示结尾', '教训总结'],
      '价值延伸': ['延伸思考', '拓展价值', '深度延伸'],
      '总结推荐': ['推荐总结', '购买建议总结', '最终推荐'],
      '经验总结': ['经验提炼', '心得总结', '感悟总结'],
      '总结建议': ['建议总结', '行动建议', '最终建议'],
      '总结收尾': ['对比总结', '最终结论', '选择总结'],
      '新年寄语': ['新年展望', '新年寄语', '未来寄语'],

      // fixed_phrase (固定句式) 相关
      '点破错位': ['破局', '揭示错位', '标准错位', '错位揭示'],
      '承认不足': ['坦承不足', '直面问题', '行业局限'],
      '教训总结': ['教训提炼', '反思总结', '警示教训'],
      '改进方向': ['改善方向', '优化路径', '升级方向'],
      '购买建议': ['选购建议', '入手建议', '投保建议'],

      // personal_fragment (个人碎片) 相关
      '共情接纳': ['共情', '理解认同', '情绪共鸣', '情感接纳'],
      '读者建议': ['行动建议', '实操建议', '给读者的建议'],
      '转折点': ['人生转折', '关键转折', '命运转折'],
      '收获感悟': ['心得感悟', '个人感悟', '深刻体会'],
      '正确做法': ['正确选择', '推荐做法', '正面建议'],
      'B面分析': ['B面解读', '劣势面分析', '反面分析'],
      '个人成长': ['成长感悟', '个人提升', '自我成长'],

      // 其他
      '实操建议': ['操作建议', '实用建议', '可执行建议'],
      '适用人群': ['适合人群', '目标人群', '推荐人群'],
      '选择建议': ['如何选择', '选择指南', '决策建议'],
      '展望未来': ['未来展望', '前景展望', '新年期待'],
      '行业变化': ['行业趋势', '行业变革', '趋势变化'],
    };

    // 为每个步骤名称添加通用别名
    for (const slot of slots) {
      const aliases = UNIVERSAL_ALIASES[slot.stepName];
      if (aliases) {
        for (const alias of aliases) {
          // 不覆盖已有的标准映射
          if (!stepNameToSlotId.has(alias)) {
            stepNameToSlotId.set(alias, slot.slotId);
          }
        }
      }
    }

    // 7维素材类型名称直接映射到第一步（当 LLM 输出 materialType 作为 paradigmStep 时）
    const MATERIAL_TYPE_TO_STEP: Record<string, string[]> = {
      'misconception': ['错误认知', '行业问题', '案例引入', '坑位引入'],
      'analogy': ['通俗类比', '区分工具与人'],
      'case': ['真实案例', '案例反转', '案例支撑'],
      'data': ['影响分析', '分析根源', '误导分析'],
      'golden_sentence': ['反问升华', '价值重构', '金句收尾'],
      'fixed_phrase': ['点破错位', '承认不足'],
      'personal_fragment': ['共情接纳', '转折点', '收获感悟'],
    };

    for (const [mt, stepNames] of Object.entries(MATERIAL_TYPE_TO_STEP)) {
      for (const stepName of stepNames) {
        // 如果该范式有这个步骤名称，则建立 materialType → slotId 的映射
        const existingSlotId = stepNameToSlotId.get(stepName);
        if (existingSlotId) {
          if (!stepNameToSlotId.has(mt)) {
            stepNameToSlotId.set(mt, existingSlotId);
          }
        }
      }
    }
  }

  /**
   * 获取范式结构
   */
  getParadigmStructure(paradigmCode: string): ParadigmStructure | null {
    this.ensureInitialized();
    return this.paradigmMap.get(paradigmCode) || null;
  }

  /**
   * 获取范式的所有有效 slotId
   */
  getValidSlotIds(paradigmCode: string): string[] {
    this.ensureInitialized();
    const structure = this.paradigmMap.get(paradigmCode);
    if (!structure) return [];
    return Array.from(structure.slotIdSet);
  }

  /**
   * 校验 slotId 是否属于范式的有效槽位
   */
  isValidSlotId(paradigmCode: string, slotId: string | null | undefined): boolean {
    if (!slotId) return false;
    this.ensureInitialized();
    const structure = this.paradigmMap.get(paradigmCode);
    if (!structure) return false;
    return structure.slotIdSet.has(slotId);
  }

  /**
   * 根据步骤名称获取标准 slotId
   * 解决不同文章提取的步骤名称不一致的问题
   */
  standardizeSlotId(paradigmCode: string, stepName: string | null | undefined, fallbackOrder?: number): string | null {
    if (!stepName && fallbackOrder === undefined) return null;
    
    this.ensureInitialized();
    const structure = this.paradigmMap.get(paradigmCode);
    if (!structure) return null;

    // 1. 尝试从步骤名称映射
    if (stepName) {
      const normalized = stepName.trim();
      const slotId = structure.stepNameToSlotId.get(normalized);
      if (slotId) return slotId;

      // 尝试模糊匹配
      for (const [name, id] of structure.stepNameToSlotId) {
        if (name.includes(normalized) || normalized.includes(name)) {
          return id;
        }
      }
    }

    // 2. 使用段落序号兜底
    if (fallbackOrder !== undefined) {
      const order = Math.max(1, Math.min(fallbackOrder, structure.slots.length));
      const slot = structure.slots.find(s => s.order === order);
      if (slot) return slot.slotId;
    }

    return null;
  }

  /**
   * 检测范式缺失的必填槽位
   */
  detectMissingSlots(paradigmCode: string, availableSlotIds: string[]): {
    missing: ParadigmSlot[];
    hasMissingRequired: boolean;
  } {
    this.ensureInitialized();
    const structure = this.paradigmMap.get(paradigmCode);
    if (!structure) {
      return { missing: [], hasMissingRequired: false };
    }

    const availableSet = new Set(availableSlotIds);
    const missing: ParadigmSlot[] = [];

    for (const slot of structure.slots) {
      if (!availableSet.has(slot.slotId)) {
        missing.push(slot);
      }
    }

    return {
      missing,
      hasMissingRequired: missing.some(s => s.required),
    };
  }

  /**
   * 过滤素材：只保留属于当前范式的有效素材
   */
  filterMaterialsForParadigm<T extends { slotId?: string | null; paradigmId?: string | null }>(
    paradigmCode: string,
    materials: T[],
    requireParadigmMatch: boolean = true
  ): T[] {
    this.ensureInitialized();
    const structure = this.paradigmMap.get(paradigmCode);
    if (!structure) {
      console.warn(`[ParadigmSlotManager] 范式 ${paradigmCode} 不存在，返回空素材列表`);
      return [];
    }

    return materials.filter(m => {
      // 1. 必须有 slotId
      if (!m.slotId) {
        console.log(`[ParadigmSlotManager] 素材缺少 slotId，跳过: ${JSON.stringify(m).substring(0, 100)}...`);
        return false;
      }

      // 2. slotId 必须属于当前范式的有效槽位
      if (!structure.slotIdSet.has(m.slotId)) {
        console.log(`[ParadigmSlotManager] 素材 slotId=${m.slotId} 不属于范式 ${paradigmCode}，跳过`);
        return false;
      }

      // 3. 如果要求范式匹配，检查 paradigmId
      if (requireParadigmMatch && m.paradigmId && m.paradigmId !== paradigmCode) {
        console.log(`[ParadigmSlotManager] 素材 paradigmId=${m.paradigmId} 与目标范式 ${paradigmCode} 不匹配，跳过`);
        return false;
      }

      return true;
    });
  }

  /**
   * 按槽位分组素材
   */
  groupMaterialsBySlot<T extends { slotId?: string | null }>(
    paradigmCode: string,
    materials: T[]
  ): Map<string, T[]> {
    this.ensureInitialized();
    const structure = this.paradigmMap.get(paradigmCode);
    const groups = new Map<string, T[]>();

    if (!structure) return groups;

    // 初始化所有槽位
    for (const slotId of structure.slotIdSet) {
      groups.set(slotId, []);
    }

    // 分组
    for (const material of materials) {
      if (material.slotId && structure.slotIdSet.has(material.slotId)) {
        const group = groups.get(material.slotId)!;
        group.push(material);
      }
    }

    return groups;
  }

  /**
   * 获取槽位详情
   */
  getSlotDetail(paradigmCode: string, slotId: string): ParadigmSlot | null {
    this.ensureInitialized();
    const structure = this.paradigmMap.get(paradigmCode);
    if (!structure) return null;
    return structure.slots.find(s => s.slotId === slotId) || null;
  }

  /**
   * 根据素材类型查找范式槽位（核心绑定方法）
   * 
   * 选定范式后，素材的范围和位置就定了：
   * - 只有 materialPositionMap 中 materialTypes 包含该素材类型的槽位才能放置
   * - isPrimary=true 的槽位优先（主要素材位置）
   * 
   * @returns 匹配的槽位条目列表，按优先级排序（isPrimary 优先 → order 升序）
   */
  findSlotsByMaterialType(paradigmCode: string, materialType: string): MaterialPositionEntry[] {
    this.ensureInitialized();
    const structure = this.paradigmMap.get(paradigmCode);
    if (!structure) return [];

    const entries = structure.materialTypeToSlots.get(materialType);
    if (!entries || entries.length === 0) return [];

    // 排序：isPrimary 优先，然后按 order（slotId 中的数字部分）
    return [...entries].sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      // 从 slotId 提取顺序号
      const orderA = parseInt(a.slotId.split('-')[1] || '0', 10);
      const orderB = parseInt(b.slotId.split('-')[1] || '0', 10);
      return orderA - orderB;
    });
  }

  /**
   * 查找素材的最佳 slotId（两阶段查找）
   * 
   * 阶段1: 根据 paradigmStep（步骤名称）直接匹配
   *   - LLM 提取时输出的步骤名称 → 匹配 stepNameToSlotId
   * 阶段2: 根据 materialType（素材类型）反向匹配
   *   - 使用 materialPositionMap 查找哪些槽位接受该素材类型
   *   - 优先选择 isPrimary=true 的主要槽位
   *   - 排除已被占用的槽位（通过 usedSlotIds 参数）
   * 
   * @param paradigmCode 范式代码
   * @param materialType 素材类型（如 misconception, case, analogy 等）
   * @param paradigmStep LLM 输出的步骤名称（可选）
   * @param usedSlotIds 已被占用的 slotId 集合（避免重复分配）
   * @returns 最佳匹配的 slotId，未找到返回 null
   */
  findBestSlotId(
    paradigmCode: string,
    materialType: string,
    paradigmStep?: string | null,
    usedSlotIds?: Set<string>
  ): string | null {
    this.ensureInitialized();
    const structure = this.paradigmMap.get(paradigmCode);
    if (!structure) return null;

    const used = usedSlotIds || new Set<string>();

    // 阶段1: 通过步骤名称直接匹配
    if (paradigmStep) {
      const normalized = paradigmStep.trim();
      const directMatch = structure.stepNameToSlotId.get(normalized);
      if (directMatch && !used.has(directMatch)) {
        // 验证该槽位是否接受此素材类型
        const positionEntry = structure.materialPositionMap.find(
          e => e.slotId === directMatch && e.materialTypes.includes(materialType)
        );
        if (positionEntry) {
          return directMatch;
        }
      }

      // 模糊匹配步骤名称
      for (const [name, id] of structure.stepNameToSlotId) {
        if (used.has(id)) continue;
        if (name.includes(normalized) || normalized.includes(name)) {
          const positionEntry = structure.materialPositionMap.find(
            e => e.slotId === id && e.materialTypes.includes(materialType)
          );
          if (positionEntry) {
            return id;
          }
        }
      }
    }

    // 阶段2: 通过素材类型反向匹配
    const candidateSlots = this.findSlotsByMaterialType(paradigmCode, materialType);
    
    // 优先选择 isPrimary 且未被占用的槽位
    const primarySlot = candidateSlots.find(e => e.isPrimary && !used.has(e.slotId));
    if (primarySlot) return primarySlot.slotId;

    // 其次选择非 primary 但未被占用的槽位
    const availableSlot = candidateSlots.find(e => !used.has(e.slotId));
    if (availableSlot) return availableSlot.slotId;

    // 所有槽位都被占用，返回 null
    console.warn(
      `[ParadigmSlotManager] 范式 ${paradigmCode} 中素材类型 ${materialType} 的所有槽位已被占用`,
      { usedSlotIds: Array.from(used), candidateSlots: candidateSlots.map(s => s.slotId) }
    );
    return null;
  }

  /**
   * 获取范式的素材位置映射（供创作流程使用）
   * 创作时，选定范式后，素材的范围和出现位置就定了
   */
  getMaterialPositionMap(paradigmCode: string): MaterialPositionEntry[] {
    this.ensureInitialized();
    const structure = this.paradigmMap.get(paradigmCode);
    if (!structure) return [];
    return structure.materialPositionMap;
  }

  /**
   * 获取范式允许的所有素材类型（选定范式 = 素材范围确定）
   */
  getAllowedMaterialTypes(paradigmCode: string): string[] {
    this.ensureInitialized();
    const structure = this.paradigmMap.get(paradigmCode);
    if (!structure) return [];
    
    const typeSet = new Set<string>();
    for (const entry of structure.materialPositionMap) {
      for (const mt of entry.materialTypes) {
        typeSet.add(mt);
      }
    }
    return Array.from(typeSet);
  }

  /**
   * 获取指定素材类型在范式中可出现的位置描述（选定范式 = 素材位置确定）
   * @returns 每个可出现位置的详细信息
   */
  getMaterialPositionDescription(paradigmCode: string, materialType: string): {
    slotId: string;
    stepName: string;
    isPrimary: boolean;
    isOptional: boolean;
  }[] {
    const entries = this.findSlotsByMaterialType(paradigmCode, materialType);
    return entries.map(e => ({
      slotId: e.slotId,
      stepName: e.stepName,
      isPrimary: e.isPrimary,
      isOptional: e.isOptional,
    }));
  }

  /**
   * 生成素材缺失警告信息
   */
  generateMissingSlotsWarning(paradigmCode: string, missing: ParadigmSlot[]): string {
    if (missing.length === 0) return '';

    const structure = this.paradigmMap.get(paradigmCode);
    if (!structure) return '';

    const requiredMissing = missing.filter(s => s.required);
    const optionalMissing = missing.filter(s => !s.required);

    let warning = `【范式 ${structure.paradigmName} 素材缺失警告】\n`;

    if (requiredMissing.length > 0) {
      warning += `\n⚠️ 必填槽位缺失（${requiredMissing.length}个）：\n`;
      for (const slot of requiredMissing) {
        warning += `  - ${slot.slotId}（${slot.stepName}）：${slot.contentRequirement.substring(0, 30)}...\n`;
      }
    }

    if (optionalMissing.length > 0) {
      warning += `\n📋 可选槽位缺失（${optionalMissing.length}个）：\n`;
      for (const slot of optionalMissing) {
        warning += `  - ${slot.slotId}（${slot.stepName}）\n`;
      }
    }

    warning += `\n建议：请补充缺失槽位的素材，或选择其他已完整初始化的范式。`;

    return warning;
  }
}

// 导出单例
export const ParadigmSlotManager = new ParadigmSlotManagerClass();

/**
 * 便捷函数：校验 slotId 是否属于范式的有效槽位
 * 供 API 路由直接使用，无需先获取 ParadigmSlotManager 实例
 */
export function isSlotValidForParadigm(paradigmCode: string, slotId: string): boolean {
  return ParadigmSlotManager.isValidSlotId(paradigmCode, slotId);
}

/**
 * 便捷函数：根据步骤名称获取标准 slotId
 */
export function getStandardizedSlotId(paradigmCode: string, stepName: string, fallbackOrder?: number): string | null {
  return ParadigmSlotManager.standardizeSlotId(paradigmCode, stepName, fallbackOrder);
}

/**
 * 便捷函数：根据素材类型查找最佳 slotId（两阶段查找）
 * 创作时，选定范式后，素材的范围和位置就定了
 */
export function findBestSlotIdForMaterial(
  paradigmCode: string,
  materialType: string,
  paradigmStep?: string | null,
  usedSlotIds?: Set<string>
): string | null {
  return ParadigmSlotManager.findBestSlotId(paradigmCode, materialType, paradigmStep, usedSlotIds);
}

/**
 * 便捷函数：获取范式允许的所有素材类型
 */
export function getAllowedMaterialTypes(paradigmCode: string): string[] {
  return ParadigmSlotManager.getAllowedMaterialTypes(paradigmCode);
}

/**
 * 便捷函数：获取范式的素材位置映射
 */
export function getMaterialPositionMap(paradigmCode: string): MaterialPositionEntry[] {
  return ParadigmSlotManager.getMaterialPositionMap(paradigmCode);
}
