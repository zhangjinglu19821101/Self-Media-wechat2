/**
 * 获取当前用户 session 信息 API 路由
 * 
 * GET /api/auth/session
 * 功能：返回当前登录用户的详细信息（用于账户设置页面）
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema/auth';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    // 查询账户详细信息
    const [account] = await db.select({
      id: accounts.id,
      email: accounts.email,
      name: accounts.name,
      role: accounts.role,
      createdAt: accounts.createdAt,
      lastLoginAt: accounts.lastLoginAt,
    })
      .from(accounts)
      .where(eq(accounts.id, session.user.id))
      .limit(1);

    if (!account) {
      return NextResponse.json(
        { success: false, error: '账户不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: account,
    });

  } catch (error: any) {
    console.error('[SessionAPI] 获取用户信息失败:', error);
    return NextResponse.json(
      { success: false, error: '获取用户信息失败' },
      { status: 500 }
    );
  }
}
