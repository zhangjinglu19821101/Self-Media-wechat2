/**
 * 权限管理系统
 * 负责管理Agent对规则的访问权限
 */

import {
  Permission,
  PermissionAction,
  AgentId,
  RuleScope,
} from './rule-types';
import { ruleManager } from './rule-manager';

/**
 * 权限管理器
 */
export class PermissionManager {
  private permissions: Map<string, Permission> = new Map();

  /**
   * 初始化默认权限
   */
  initializeDefaultPermissions(): void {
    // Agent B（技术总负责人）拥有所有权限
    this.grantFullPermissions('B');

    // Agent C（AI运营）只能访问通用规则和AI赛道规则
    this.grantUniversalPermissions('C');
    this.grantAIScopePermissions('C');

    // Agent D（AI内容）只能访问通用规则和AI赛道规则
    this.grantUniversalPermissions('D');
    this.grantAIScopePermissions('D');

    // Insurance-c（保险运营）只能访问通用规则和保险赛道规则
    this.grantUniversalPermissions('insurance-c');
    this.grantInsuranceScopePermissions('insurance-c');

    // Insurance-d（保险内容）只能访问通用规则和保险赛道规则
    this.grantUniversalPermissions('insurance-d');
    this.grantInsuranceScopePermissions('insurance-d');

    // Agent A（总协调者）拥有读取权限
    this.grantReadAllPermissions('A');
  }

  /**
   * 授予所有权限
   */
  private grantFullPermissions(agentId: AgentId): void {
    const actions = Object.values(PermissionAction);
    for (const action of actions) {
      const permissionId = `perm_${agentId}_${action}_all`;
      const permission: Permission = {
        id: permissionId,
        agentId,
        action,
        grantedBy: 'B' as AgentId,
        grantedAt: new Date(),
      };
      this.permissions.set(permissionId, permission);
    }
  }

  /**
   * 授予通用规则权限
   */
  private grantUniversalPermissions(agentId: AgentId): void {
    const actions = [PermissionAction.READ, PermissionAction.EXECUTE];
    for (const action of actions) {
      const permissionId = `perm_${agentId}_${action}_universal`;
      const permission: Permission = {
        id: permissionId,
        agentId,
        action,
        grantedBy: 'B' as AgentId,
        grantedAt: new Date(),
      };
      this.permissions.set(permissionId, permission);
    }
  }

  /**
   * 授予AI赛道权限
   */
  private grantAIScopePermissions(agentId: AgentId): void {
    const actions = [PermissionAction.READ, PermissionAction.EXECUTE];
    for (const action of actions) {
      const permissionId = `perm_${agentId}_${action}_ai`;
      const permission: Permission = {
        id: permissionId,
        agentId,
        action,
        grantedBy: 'B' as AgentId,
        grantedAt: new Date(),
      };
      this.permissions.set(permissionId, permission);
    }
  }

  /**
   * 授予保险赛道权限
   */
  private grantInsuranceScopePermissions(agentId: AgentId): void {
    const actions = [PermissionAction.READ, PermissionAction.EXECUTE];
    for (const action of actions) {
      const permissionId = `perm_${agentId}_${action}_insurance`;
      const permission: Permission = {
        id: permissionId,
        agentId,
        action,
        grantedBy: 'B' as AgentId,
        grantedAt: new Date(),
      };
      this.permissions.set(permissionId, permission);
    }
  }

  /**
   * 授予所有读取权限
   */
  private grantReadAllPermissions(agentId: AgentId): void {
    const permissionId = `perm_${agentId}_read_all`;
    const permission: Permission = {
      id: permissionId,
      agentId,
      action: PermissionAction.READ,
      grantedBy: 'B' as AgentId,
      grantedAt: new Date(),
    };
    this.permissions.set(permissionId, permission);
  }

  /**
   * 检查Agent是否有权限执行操作
   */
  checkPermission(
    agentId: AgentId,
    ruleScope: RuleScope,
    action: PermissionAction
  ): boolean {
    // Agent B拥有所有权限
    if (agentId === 'B') {
      return true;
    }

    // 查找权限
    const permissions = Array.from(this.permissions.values()).filter(
      (p) => p.agentId === agentId && p.action === action
    );

    if (permissions.length === 0) {
      return false;
    }

    // 检查是否有权限访问指定范围的规则
    for (const permission of permissions) {
      if (!permission.ruleId) {
        // 没有指定规则ID，说明是全局权限
        return true;
      }
    }

    // 检查范围权限
    const scopePermissionKey = `${agentId}_${action}_${ruleScope}`;
    const hasScopePermission = this.permissions.has(`perm_${scopePermissionKey}`);

    // 通用规则所有人都可以访问
    if (ruleScope === RuleScope.UNIVERSAL) {
      const universalPermissionKey = `${agentId}_${action}_universal`;
      return this.permissions.has(`perm_${universalPermissionKey}`);
    }

    return hasScopePermission;
  }

  /**
   * 检查Agent是否有权限访问特定规则
   */
  checkRulePermission(agentId: AgentId, ruleId: string, action: PermissionAction): boolean {
    // Agent B拥有所有权限
    if (agentId === 'B') {
      return true;
    }

    // 获取规则信息
    const rule = ruleManager.getRule(ruleId);
    if (!rule) {
      return false;
    }

    // 检查范围权限
    return this.checkPermission(agentId, rule.scope, action);
  }

  /**
   * 授权
   */
  grantPermission(
    agentId: AgentId,
    action: PermissionAction,
    ruleScope?: RuleScope,
    ruleId?: string,
    grantedBy: AgentId = 'B'
  ): { success: boolean; permissionId?: string; error?: string } {
    try {
      const permissionId = `perm_${agentId}_${action}_${ruleScope || 'all'}_${ruleId || 'all'}`;

      // 检查权限是否已存在
      if (this.permissions.has(permissionId)) {
        return {
          success: false,
          error: '权限已存在',
        };
      }

      const permission: Permission = {
        id: permissionId,
        agentId,
        action,
        grantedBy,
        grantedAt: new Date(),
      };

      if (ruleId) {
        permission.ruleId = ruleId;
      }

      this.permissions.set(permissionId, permission);

      return {
        success: true,
        permissionId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 撤销权限
   */
  revokePermission(
    agentId: AgentId,
    action: PermissionAction,
    ruleScope?: RuleScope,
    ruleId?: string
  ): { success: boolean; error?: string } {
    try {
      const permissionId = `perm_${agentId}_${action}_${ruleScope || 'all'}_${ruleId || 'all'}`;

      if (!this.permissions.has(permissionId)) {
        return {
          success: false,
          error: '权限不存在',
        };
      }

      this.permissions.delete(permissionId);

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
   * 获取Agent的所有权限
   */
  getAgentPermissions(agentId: AgentId): Permission[] {
    return Array.from(this.permissions.values()).filter((p) => p.agentId === agentId);
  }

  /**
   * 获取所有权限
   */
  getAllPermissions(): Permission[] {
    return Array.from(this.permissions.values());
  }

  /**
   * 清除所有权限
   */
  clearAllPermissions(): void {
    this.permissions.clear();
  }
}

// 导出单例实例
export const permissionManager = new PermissionManager();
