/**
 * 规则存储管理系统
 * 负责管理规则的CRUD操作和规则库管理
 */

import {
  Rule,
  RuleLibrary,
  RuleFilter,
  RuleCategory,
  RuleStatus,
  RuleScope,
  AgentId,
} from './rule-types';

/**
 * 规则管理器
 */
export class RuleManager {
  // 内存存储（实际项目中应该使用数据库）
  private rules: Map<string, Rule> = new Map();
  private ruleLibraries: Map<string, RuleLibrary> = new Map();

  /**
   * 创建规则库
   */
  createRuleLibrary(
    name: string,
    description: string,
    type: RuleScope,
    createdBy: AgentId
  ): { success: boolean; libraryId?: string; error?: string } {
    try {
      const libraryId = `library_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const library: RuleLibrary = {
        id: libraryId,
        name,
        description,
        type,
        createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.ruleLibraries.set(libraryId, library);

      return {
        success: true,
        libraryId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 获取规则库
   */
  getRuleLibrary(libraryId: string): RuleLibrary | null {
    return this.ruleLibraries.get(libraryId) || null;
  }

  /**
   * 获取所有规则库
   */
  getAllRuleLibraries(): RuleLibrary[] {
    return Array.from(this.ruleLibraries.values());
  }

  /**
   * 删除规则库
   */
  deleteRuleLibrary(libraryId: string): { success: boolean; error?: string } {
    try {
      const library = this.ruleLibraries.get(libraryId);
      if (!library) {
        return {
          success: false,
          error: '规则库不存在',
        };
      }

      // 检查是否有规则正在使用该规则库
      const rulesInLibrary = Array.from(this.rules.values()).filter(
        (rule) => rule.landingCarrier === library.name
      );

      if (rulesInLibrary.length > 0) {
        return {
          success: false,
          error: `规则库中有 ${rulesInLibrary.length} 个规则，无法删除`,
        };
      }

      this.ruleLibraries.delete(libraryId);

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 保存规则
   */
  saveRule(rule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'successRate'>): {
    success: boolean;
    ruleId?: string;
    error?: string;
  } {
    try {
      const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const newRule: Rule = {
        ...rule,
        id: ruleId,
        createdAt: new Date(),
        updatedAt: new Date(),
        publishedAt: rule.status === RuleStatus.PUBLISHED ? new Date() : undefined,
        usageCount: 0,
        successRate: 100, // 初始成功率100%
      };

      this.rules.set(ruleId, newRule);

      return {
        success: true,
        ruleId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 获取规则
   */
  getRule(ruleId: string): Rule | null {
    return this.rules.get(ruleId) || null;
  }

  /**
   * 查询规则（支持多种过滤条件）
   */
  queryRules(filters: RuleFilter): Rule[] {
    let rules = Array.from(this.rules.values());

    // 按分类过滤
    if (filters.category) {
      rules = rules.filter((rule) => rule.category === filters.category);
    }

    // 按状态过滤
    if (filters.status) {
      rules = rules.filter((rule) => rule.status === filters.status);
    }

    // 按适用范围过滤
    if (filters.scope) {
      rules = rules.filter((rule) => rule.scope === filters.scope);
    }

    // 按创建者过滤
    if (filters.createdBy) {
      rules = rules.filter((rule) => rule.createdBy === filters.createdBy);
    }

    // 按标签过滤
    if (filters.tags && filters.tags.length > 0) {
      rules = rules.filter((rule) =>
        filters.tags!.some((tag) => rule.tags.includes(tag))
      );
    }

    // 按关键字过滤
    if (filters.keyword) {
      const keyword = filters.keyword.toLowerCase();
      rules = rules.filter(
        (rule) =>
          rule.name.toLowerCase().includes(keyword) ||
          rule.description.toLowerCase().includes(keyword)
      );
    }

    // 按创建时间倒序排列
    rules.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return rules;
  }

  /**
   * 更新规则
   */
  updateRule(
    ruleId: string,
    updates: Partial<Rule>
  ): { success: boolean; error?: string } {
    try {
      const rule = this.rules.get(ruleId);
      if (!rule) {
        return {
          success: false,
          error: '规则不存在',
        };
      }

      // 如果更新状态为已发布，记录发布时间
      if (updates.status === RuleStatus.PUBLISHED && rule.status !== RuleStatus.PUBLISHED) {
        updates.publishedAt = new Date();
      }

      const updatedRule: Rule = {
        ...rule,
        ...updates,
        id: ruleId,
        createdAt: rule.createdAt,
        updatedAt: new Date(),
      };

      this.rules.set(ruleId, updatedRule);

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 删除规则
   */
  deleteRule(ruleId: string): { success: boolean; error?: string } {
    try {
      const rule = this.rules.get(ruleId);
      if (!rule) {
        return {
          success: false,
          error: '规则不存在',
        };
      }

      // 如果规则是已发布状态，不允许删除，只能标记为已废弃
      if (rule.status === RuleStatus.PUBLISHED) {
        // 自动标记为已废弃
        this.updateRule(ruleId, { status: RuleStatus.DEPRECATED });
        return {
          success: true,
        };
      }

      this.rules.delete(ruleId);

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 发布规则
   */
  publishRule(ruleId: string): { success: boolean; error?: string } {
    try {
      const rule = this.rules.get(ruleId);
      if (!rule) {
        return {
          success: false,
          error: '规则不存在',
        };
      }

      return this.updateRule(ruleId, {
        status: RuleStatus.PUBLISHED,
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 记录规则使用
   */
  recordRuleUsage(ruleId: string, success: boolean): { success: boolean; error?: string } {
    try {
      const rule = this.rules.get(ruleId);
      if (!rule) {
        return {
          success: false,
          error: '规则不存在',
        };
      }

      // 更新使用统计
      const newUsageCount = rule.usageCount + 1;
      const newSuccessCount = success ? (rule.successRate * rule.usageCount) / 100 + 1 : (rule.successRate * rule.usageCount) / 100;
      const newSuccessRate = (newSuccessCount / newUsageCount) * 100;

      this.updateRule(ruleId, {
        usageCount: newUsageCount,
        successRate: Math.round(newSuccessRate * 100) / 100,
      });

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 获取统计信息
   */
  getStatistics(): {
    totalRules: number;
    publishedRules: number;
    draftRules: number;
    deprecatedRules: number;
    totalUsageCount: number;
    averageSuccessRate: number;
  } {
    const rules = Array.from(this.rules.values());

    const publishedRules = rules.filter((r) => r.status === RuleStatus.PUBLISHED).length;
    const draftRules = rules.filter((r) => r.status === RuleStatus.DRAFT).length;
    const deprecatedRules = rules.filter((r) => r.status === RuleStatus.DEPRECATED).length;
    const totalUsageCount = rules.reduce((sum, r) => sum + r.usageCount, 0);
    const averageSuccessRate =
      rules.length > 0
        ? rules.reduce((sum, r) => sum + r.successRate, 0) / rules.length
        : 0;

    return {
      totalRules: rules.length,
      publishedRules,
      draftRules,
      deprecatedRules,
      totalUsageCount,
      averageSuccessRate: Math.round(averageSuccessRate * 100) / 100,
    };
  }
}

// 导出单例实例
export const ruleManager = new RuleManager();
