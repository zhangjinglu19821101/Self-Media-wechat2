/**
 * 范式槽位管理服务
 * 
 * 核心职责：
 * 1. 提供标准的范式槽位定义（与 paradigm-seed-data 同步）
 * 2. 校验素材的 slotId 是否属于有效槽位
 * 3. 标准化不同文章提取的素材到统一的 slotId
 * 4. 检测范式缺失的槽位
 * 
 * 设计原则：
 * - 一个范式 = 一组固定的槽位（slotId）
 * - 一个槽位 = 一个段落功能（如"错误认知"、"共情接纳"）
 * - 素材必须绑定到有效槽位才能在创作时使用
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

// 范式结构定义
export interface ParadigmStructure {
  paradigmCode: string;
  paradigmName: string;
  description: string;
  slots: ParadigmSlot[];
  slotIdSet: Set<string>;   // 快速查找用
  stepNameToSlotId: Map<string, string>; // 步骤名称 → slotId 映射
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
        // 常见变体
        if (slot.stepName === '错误认知') {
          stepNameToSlotId.set('认知错误', slot.slotId);
          stepNameToSlotId.set('误区引入', slot.slotId);
          stepNameToSlotId.set('常见误区', slot.slotId);
        }
        if (slot.stepName === '共情接纳') {
          stepNameToSlotId.set('共情', slot.slotId);
          stepNameToSlotId.set('理解认同', slot.slotId);
        }
        if (slot.stepName === '点破错位') {
          stepNameToSlotId.set('破局', slot.slotId);
          stepNameToSlotId.set('揭示错位', slot.slotId);
          stepNameToSlotId.set('标准错位', slot.slotId);
        }
        if (slot.stepName === '通俗类比') {
          stepNameToSlotId.set('类比', slot.slotId);
          stepNameToSlotId.set('生活类比', slot.slotId);
        }
        if (slot.stepName === '真实案例') {
          stepNameToSlotId.set('案例', slot.slotId);
          stepNameToSlotId.set('案例分析', slot.slotId);
        }
        if (slot.stepName === '反问升华') {
          stepNameToSlotId.set('反问', slot.slotId);
          stepNameToSlotId.set('升华', slot.slotId);
        }
        if (slot.stepName === '价值重构') {
          stepNameToSlotId.set('收尾', slot.slotId);
          stepNameToSlotId.set('总结', slot.slotId);
          stepNameToSlotId.set('金句收尾', slot.slotId);
        }
      }

      this.paradigmMap.set(paradigm.paradigmCode, {
        paradigmCode: paradigm.paradigmCode,
        paradigmName: paradigm.paradigmName,
        description: paradigm.description,
        slots,
        slotIdSet,
        stepNameToSlotId,
      });
    }

    this.initialized = true;
    console.log(`[ParadigmSlotManager] 初始化完成，加载 ${this.paradigmMap.size} 套范式`);
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
