/**
 * Workspace API
 * 
 * GET  /api/workspaces          - 获取当前用户的所有 workspace
 * POST /api/workspaces          - 创建新的 workspace（企业类型）
 */

import { NextResponse } from 'next/server';
import { auth, getUserWorkspaces } from '@/lib/auth';
import { db } from '@/lib/db';
import { workspaces, workspaceMembers, accounts } from '@/lib/db/schema/auth';
import { eq } from 'drizzle-orm';
import { WorkspaceRole } from '@/lib/db/schema/auth';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const workspacesList = await getUserWorkspaces(session.user.id);

    return NextResponse.json({
      success: true,
      data: workspacesList,
    });
  } catch (error: any) {
    console.error('[Workspaces] 获取失败:', error);
    return NextResponse.json({ error: '获取工作空间失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { name, type = 'enterprise', companyName } = body;

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: '工作空间名称至少需要 2 个字符' }, { status: 400 });
    }

    // 生成 slug
    const slug = `${type}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // 创建 workspace
    const [workspace] = await db.insert(workspaces).values({
      name: name.trim(),
      slug,
      type,
      ownerAccountId: session.user.id,
      companyName: companyName?.trim() || null,
    }).returning();

    if (!workspace) {
      return NextResponse.json({ error: '创建工作空间失败' }, { status: 500 });
    }

    // 将创建者添加为 Owner
    await db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      accountId: session.user.id,
      role: WorkspaceRole.OWNER,
      status: 'active',
      joinedAt: new Date(),
    });

    console.log(`[Workspaces] 创建成功: ${workspace.name} (${workspace.slug})`);

    return NextResponse.json({
      success: true,
      data: workspace,
    });
  } catch (error: any) {
    console.error('[Workspaces] 创建失败:', error);
    return NextResponse.json({ error: '创建工作空间失败' }, { status: 500 });
  }
}
