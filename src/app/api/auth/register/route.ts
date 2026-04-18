/**
 * 注册 API
 * 
 * POST /api/auth/register
 * 
 * 流程：
 * 1. 校验邮箱和密码
 * 2. 创建 Account
 * 3. 自动创建 Personal Workspace
 * 4. 将 Account 添加为 Workspace Owner
 * 5. 初始化默认数据（平台账号、风格模板）
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { accounts, workspaces, workspaceMembers } from '@/lib/db/schema/auth';
import { eq } from 'drizzle-orm';
import { hashPassword, validatePasswordStrength, validateEmail } from '@/lib/auth/password';
import { WorkspaceRole } from '@/lib/db/schema/auth';
import { initializeUserData } from '@/lib/services/init-user-data';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    // 1. 参数校验
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: '请填写邮箱、密码和姓名' },
        { status: 400 }
      );
    }

    if (!validateEmail(email)) {
      return NextResponse.json(
        { error: '邮箱格式不正确' },
        { status: 400 }
      );
    }

    const strengthCheck = validatePasswordStrength(password);
    if (!strengthCheck.valid) {
      return NextResponse.json(
        { error: strengthCheck.message },
        { status: 400 }
      );
    }

    if (name.trim().length < 2) {
      return NextResponse.json(
        { error: '姓名至少需要 2 个字符' },
        { status: 400 }
      );
    }

    // 2. 检查邮箱是否已注册
    const [existing] = await db.select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.email, email.trim().toLowerCase()))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: '该邮箱已注册' },
        { status: 409 }
      );
    }

    // 3. 创建 Account
    const passwordHash = await hashPassword(password);
    const [account] = await db.insert(accounts).values({
      email: email.trim().toLowerCase(),
      emailVerified: false,
      passwordHash,
      name: name.trim(),
    }).returning();

    if (!account) {
      return NextResponse.json(
        { error: '注册失败，请重试' },
        { status: 500 }
      );
    }

    // 4. 自动创建 Personal Workspace
    const slug = `personal-${account.id.substring(0, 8)}`;
    const [workspace] = await db.insert(workspaces).values({
      name: `${name.trim()}的工作空间`,
      slug,
      type: 'personal',
      ownerAccountId: account.id,
    }).returning();

    // 5. 将 Account 添加为 Workspace Owner
    if (workspace) {
      await db.insert(workspaceMembers).values({
        workspaceId: workspace.id,
        accountId: account.id,
        role: WorkspaceRole.OWNER,
        status: 'active',
        joinedAt: new Date(),
      });

      // 6. 初始化默认数据（平台账号、风格模板）
      await initializeUserData(account.id, workspace.id);
    }

    console.log(`[Register] 注册成功: ${email}, workspace: ${workspace?.slug}`);

    return NextResponse.json({
      success: true,
      message: '注册成功',
      data: {
        accountId: account.id,
        workspaceId: workspace?.id,
        email: account.email,
        name: account.name,
      },
    });
  } catch (error: any) {
    console.error('[Register] 注册失败:', error);
    return NextResponse.json(
      { error: '注册失败，请稍后重试' },
      { status: 500 }
    );
  }
}
