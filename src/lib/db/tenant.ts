/**
 * Workspace 租户隔离工具
 * 
 * 提供：
 * 1. 获取账户可访问的所有 workspace ID
 * 2. 当前 workspace 上下文管理（前端用）
 * 3. workspaceId 安全提取
 */

import { db } from '@/lib/db';
import { workspaces, workspaceMembers } from '@/lib/db/schema/auth';
import { eq, and } from 'drizzle-orm';

/**
 * 获取账户可访问的所有 workspace ID
 */
export async function getAccessibleWorkspaceIds(accountId: string): Promise<string[]> {
  // 1. 自己拥有的 workspace
  const owned = await db.select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.ownerAccountId, accountId));

  // 2. 自己参与的 workspace（active 成员）
  const memberOf = await db.select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.accountId, accountId),
        eq(workspaceMembers.status, 'active'),
      )
    );

  const ids = [
    ...owned.map(w => w.id),
    ...memberOf.map(m => m.workspaceId),
  ];

  // 去重
  return [...new Set(ids)];
}

/**
 * 校验账户是否有权访问指定 workspace
 */
export async function canAccessWorkspace(accountId: string, workspaceId: string): Promise<boolean> {
  // 方式1：是 workspace 的 owner
  const [owned] = await db.select({ id: workspaces.id })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.id, workspaceId),
        eq(workspaces.ownerAccountId, accountId),
      )
    )
    .limit(1);

  if (owned) return true;

  // 方式2：是 workspace 的 active 成员
  const [member] = await db.select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.accountId, accountId),
        eq(workspaceMembers.status, 'active'),
      )
    )
    .limit(1);

  return !!member;
}

/**
 * 从请求中提取 workspaceId
 * 优先级：header > query param > cookie
 */
export function extractWorkspaceId(request: Request): string | null {
  // 1. 从 header 获取
  const headerWsId = request.headers.get('x-workspace-id');
  if (headerWsId) return headerWsId;

  // 2. 从 URL params 获取
  const url = new URL(request.url);
  const queryWsId = url.searchParams.get('workspaceId');
  if (queryWsId) return queryWsId;

  return null;
}

/**
 * 获取账户在 workspace 中的角色
 */
export async function getWorkspaceRole(accountId: string, workspaceId: string): Promise<string | null> {
  // 1. 检查是否是 owner
  const [workspace] = await db.select({ ownerAccountId: workspaces.ownerAccountId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) return null;

  if (workspace.ownerAccountId === accountId) {
    return 'owner';
  }

  // 2. 检查成员角色
  const [member] = await db.select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.accountId, accountId),
        eq(workspaceMembers.status, 'active'),
      )
    )
    .limit(1);

  return member?.role || null;
}

/**
 * 获取账户的默认（个人）workspace ID
 * 注册时自动创建，每个用户一定有一个
 */
export async function getDefaultWorkspaceId(accountId: string): Promise<string | null> {
  const [ws] = await db.select({ id: workspaces.id })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.ownerAccountId, accountId),
        eq(workspaces.type, 'personal'),
      )
    )
    .limit(1);

  return ws?.id || null;
}
