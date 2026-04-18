/**
 * RBAC 权限控制系统
 * 
 * 两级角色模型：
 * 
 * 1. 系统级角色（Account.role）：
 *    - super_admin: 超级管理员，跨 Workspace 权限，可管理所有用户
 *    - normal: 普通用户，默认值
 * 
 * 2. Workspace 级角色（WorkspaceMember.role）：
 *    - Owner: 全部权限 + Workspace 设置 + 成员管理
 *    - Admin: 全部数据权限（除删除 Workspace 外）
 *    - Editor: 可读写数据（不能删他人资源、不能管理成员）
 *    - Viewer: 只读（仅查看数据和报表）
 */

import { WorkspaceRole, AccountRole } from '@/lib/db/schema/auth';

// ==================== 操作类型 ====================

export type Action =
  // 系统级操作（仅 super_admin）
  | 'account:view_all'        // 查看所有用户
  | 'account:disable'         // 禁用账号
  | 'account:enable'          // 启用账号
  | 'account:reset_password'  // 重置密码
  | 'workspace:view_all'      // 查看所有 Workspace
  | 'system:logs'             // 查看系统日志
  // Workspace 级操作
  | 'workspace:manage'        // Workspace 设置（改名、删除等）
  | 'member:invite'           // 邀请成员
  | 'member:remove'           // 移除成员
  | 'member:change_role'      // 变更成员角色
  | 'resource:create'         // 创建资源（任务/素材/模板等）
  | 'resource:read'           // 读取资源
  | 'resource:update_own'     // 更新自己创建的资源
  | 'resource:update_any'     // 更新任何人的资源
  | 'resource:delete_own'     // 删除自己创建的资源
  | 'resource:delete_any'     // 删除任何人的资源
  | 'publish:create'          // 创建发布任务
  | 'publish:cancel'          // 取消发布任务
  | 'style:manage'            // 管理风格模板和规则
  | 'account:manage';         // 管理平台账号

// ==================== 系统级权限（超级管理员）====================

const SUPER_ADMIN_ACTIONS: Action[] = [
  'account:view_all',
  'account:disable',
  'account:enable',
  'account:reset_password',
  'workspace:view_all',
  'system:logs',
  // 超级管理员也拥有所有 Workspace 级权限
  'workspace:manage',
  'member:invite',
  'member:remove',
  'member:change_role',
  'resource:create',
  'resource:read',
  'resource:update_own',
  'resource:update_any',
  'resource:delete_own',
  'resource:delete_any',
  'publish:create',
  'publish:cancel',
  'style:manage',
  'account:manage',
];

// ==================== Workspace 级权限矩阵 ====================

const ROLE_PERMISSIONS: Record<WorkspaceRole, Action[]> = {
  [WorkspaceRole.OWNER]: [
    'workspace:manage',
    'member:invite',
    'member:remove',
    'member:change_role',
    'resource:create',
    'resource:read',
    'resource:update_own',
    'resource:update_any',
    'resource:delete_own',
    'resource:delete_any',
    'publish:create',
    'publish:cancel',
    'style:manage',
    'account:manage',
  ],
  [WorkspaceRole.ADMIN]: [
    'resource:create',
    'resource:read',
    'resource:update_own',
    'resource:update_any',
    'resource:delete_own',
    'resource:delete_any',
    'publish:create',
    'publish:cancel',
    'style:manage',
    'account:manage',
    'member:invite',
  ],
  [WorkspaceRole.EDITOR]: [
    'resource:create',
    'resource:read',
    'resource:update_own',
    'resource:delete_own',
    'publish:create',
  ],
  [WorkspaceRole.VIEWER]: [
    'resource:read',
  ],
};

// ==================== 权限校验函数 ====================

/**
 * 检查账号是否为超级管理员
 */
export function isSuperAdmin(accountRole: string | null | undefined): boolean {
  return accountRole === AccountRole.SUPER_ADMIN;
}

/**
 * 校验角色是否有权限执行指定操作
 * @param accountRole - 系统级角色（super_admin / normal）
 * @param workspaceRole - Workspace 级角色（owner / admin / editor / viewer）
 * @param action - 要执行的操作
 */
export function canDo(
  accountRole: string | null | undefined,
  workspaceRole: WorkspaceRole | string,
  action: Action
): boolean {
  // 超级管理员拥有所有权限
  if (isSuperAdmin(accountRole)) {
    return SUPER_ADMIN_ACTIONS.includes(action);
  }
  
  // 普通 users 按 Workspace 角色检查
  const permissions = ROLE_PERMISSIONS[workspaceRole as WorkspaceRole];
  if (!permissions) return false;
  return permissions.includes(action);
}

/**
 * 仅检查 Workspace 级权限（不检查超级管理员）
 */
export function canDoInWorkspace(role: WorkspaceRole | string, action: Action): boolean {
  const permissions = ROLE_PERMISSIONS[role as WorkspaceRole];
  if (!permissions) return false;
  return permissions.includes(action);
}

/**
 * 获取角色的所有权限
 */
export function getRolePermissions(role: WorkspaceRole | string): Action[] {
  return ROLE_PERMISSIONS[role as WorkspaceRole] || [];
}

/**
 * 获取角色显示名称
 */
export function getRoleLabel(role: WorkspaceRole | string): string {
  const labels: Record<string, string> = {
    [WorkspaceRole.OWNER]: '所有者',
    [WorkspaceRole.ADMIN]: '管理员',
    [WorkspaceRole.EDITOR]: '编辑者',
    [WorkspaceRole.VIEWER]: '查看者',
  };
  return labels[role] || role;
}

/**
 * 获取账号角色显示名称
 */
export function getAccountRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    [AccountRole.SUPER_ADMIN]: '超级管理员',
    [AccountRole.NORMAL]: '普通用户',
  };
  return labels[role] || role;
}
