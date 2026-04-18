/**
 * 工作空间成员管理 API
 * 
 * GET    /api/workspaces/[id]/members     - 获取成员列表
 * POST   /api/workspaces/[id]/members     - 邀请成员
 * PATCH  /api/workspaces/[id]/members     - 变更成员角色
 * DELETE /api/workspaces/[id]/members     - 移除成员
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { workspaceMembers, accounts, workspaces } from '@/lib/db/schema/auth';
import { eq, and } from 'drizzle-orm';
import { canDo } from '@/lib/auth/roles';
import { WorkspaceRole } from '@/lib/db/schema/auth';

/**
 * 获取当前用户在指定 workspace 中的角色
 */
async function getMyRole(accountId: string, workspaceId: string): Promise<string | null> {
  // 检查是否是 owner
  const [ws] = await db.select({ ownerAccountId: workspaces.ownerAccountId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!ws) return null;
  if (ws.ownerAccountId === accountId) return 'owner';

  // 检查成员角色
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
 * GET - 获取成员列表
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const params = await props.params;
    const workspaceId = params.id;

    // 校验权限：成员可读
    const myRole = await getMyRole(session.user.id, workspaceId);
    if (!myRole) {
      return NextResponse.json({ error: '无权访问此工作空间' }, { status: 403 });
    }

    // 查询成员列表
    const members = await db.select({
      id: workspaceMembers.id,
      accountId: workspaceMembers.accountId,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
      joinedAt: workspaceMembers.joinedAt,
      invitedBy: workspaceMembers.invitedBy,
      accountName: accounts.name,
      accountEmail: accounts.email,
      accountAvatar: accounts.avatarUrl,
    })
      .from(workspaceMembers)
      .innerJoin(accounts, eq(workspaceMembers.accountId, accounts.id))
      .where(eq(workspaceMembers.workspaceId, workspaceId));

    // 同时获取 owner 信息
    const [workspace] = await db.select({
      ownerAccountId: workspaces.ownerAccountId,
    })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: {
        members,
        ownerId: workspace?.ownerAccountId,
      },
    });
  } catch (error: any) {
    console.error('[Members API] 获取成员列表失败:', error);
    return NextResponse.json({ error: '获取成员列表失败' }, { status: 500 });
  }
}

/**
 * POST - 邀请成员
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const params = await props.params;
    const workspaceId = params.id;
    const myRole = await getMyRole(session.user.id, workspaceId);

    if (!myRole || !canDo(myRole as WorkspaceRole, 'member:invite')) {
      return NextResponse.json({ error: '无权邀请成员' }, { status: 403 });
    }

    const body = await request.json();
    const { email, role } = body;

    if (!email) {
      return NextResponse.json({ error: '请填写邮箱' }, { status: 400 });
    }

    // 查找目标用户
    const [targetAccount] = await db.select()
      .from(accounts)
      .where(eq(accounts.email, email.toLowerCase().trim()))
      .limit(1);

    if (!targetAccount) {
      return NextResponse.json({ error: '该邮箱未注册' }, { status: 404 });
    }

    // 检查是否已是成员
    const [existing] = await db.select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.accountId, targetAccount.id),
        )
      )
      .limit(1);

    if (existing && existing.status === 'active') {
      return NextResponse.json({ error: '该用户已是工作空间成员' }, { status: 409 });
    }

    const targetRole = role || 'editor';

    if (existing) {
      // 重新激活
      await db.update(workspaceMembers)
        .set({
          role: targetRole,
          status: 'active',
          invitedBy: session.user.id,
          joinedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(workspaceMembers.id, existing.id));
    } else {
      // 新增成员
      await db.insert(workspaceMembers).values({
        workspaceId,
        accountId: targetAccount.id,
        role: targetRole,
        status: 'active',
        invitedBy: session.user.id,
        joinedAt: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      message: `${targetAccount.name} 已添加为 ${targetRole}`,
    });
  } catch (error: any) {
    console.error('[Members API] 邀请成员失败:', error);
    return NextResponse.json({ error: '邀请成员失败' }, { status: 500 });
  }
}

/**
 * PATCH - 变更成员角色
 */
export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const params = await props.params;
    const workspaceId = params.id;
    const myRole = await getMyRole(session.user.id, workspaceId);

    if (!myRole || !canDo(myRole as WorkspaceRole, 'member:change_role')) {
      return NextResponse.json({ error: '无权变更成员角色' }, { status: 403 });
    }

    const body = await request.json();
    const { accountId, newRole } = body;

    if (!accountId || !newRole) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    // 不能修改 owner 的角色
    const [workspace] = await db.select({ ownerAccountId: workspaces.ownerAccountId })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (workspace?.ownerAccountId === accountId) {
      return NextResponse.json({ error: '不能修改所有者的角色' }, { status: 400 });
    }

    await db.update(workspaceMembers)
      .set({ role: newRole, updatedAt: new Date() })
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.accountId, accountId),
        )
      );

    return NextResponse.json({ success: true, message: '角色已更新' });
  } catch (error: any) {
    console.error('[Members API] 变更角色失败:', error);
    return NextResponse.json({ error: '变更角色失败' }, { status: 500 });
  }
}

/**
 * DELETE - 移除成员
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const params = await props.params;
    const workspaceId = params.id;
    const myRole = await getMyRole(session.user.id, workspaceId);

    if (!myRole || !canDo(myRole as WorkspaceRole, 'member:remove')) {
      return NextResponse.json({ error: '无权移除成员' }, { status: 403 });
    }

    const accountId = request.nextUrl.searchParams.get('accountId');
    if (!accountId) {
      return NextResponse.json({ error: '缺少参数: accountId' }, { status: 400 });
    }

    // 不能移除 owner
    const [workspace] = await db.select({ ownerAccountId: workspaces.ownerAccountId })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (workspace?.ownerAccountId === accountId) {
      return NextResponse.json({ error: '不能移除所有者' }, { status: 400 });
    }

    // 标记为已移除（而非删除，保留历史记录）
    await db.update(workspaceMembers)
      .set({ status: 'removed', updatedAt: new Date() })
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.accountId, accountId),
        )
      );

    return NextResponse.json({ success: true, message: '成员已移除' });
  } catch (error: any) {
    console.error('[Members API] 移除成员失败:', error);
    return NextResponse.json({ error: '移除成员失败' }, { status: 500 });
  }
}
