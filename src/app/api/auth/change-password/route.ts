/**
 * 修改密码 API 路由
 * 
 * POST /api/auth/change-password
 * 功能：验证当前密码，修改为新密码
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema/auth';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword, validatePasswordStrength } from '@/lib/auth/password';

export async function POST(request: NextRequest) {
  try {
    // 验证用户登录状态
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // 验证输入
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: '请提供当前密码和新密码' },
        { status: 400 }
      );
    }

    // 验证新密码强度
    const strengthCheck = validatePasswordStrength(newPassword);
    if (!strengthCheck.valid) {
      return NextResponse.json(
        { success: false, error: strengthCheck.message },
        { status: 400 }
      );
    }

    // 查询用户
    const [account] = await db.select()
      .from(accounts)
      .where(eq(accounts.id, session.user.id))
      .limit(1);

    if (!account) {
      return NextResponse.json(
        { success: false, error: '账户不存在' },
        { status: 404 }
      );
    }

    // 验证当前密码
    const isCurrentPasswordValid = await verifyPassword(currentPassword, account.passwordHash);
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { success: false, error: '当前密码错误' },
        { status: 401 }
      );
    }

    // 检查新密码是否与当前密码相同
    const isSameAsCurrent = await verifyPassword(newPassword, account.passwordHash);
    if (isSameAsCurrent) {
      return NextResponse.json(
        { success: false, error: '新密码不能与当前密码相同' },
        { status: 400 }
      );
    }

    // 生成新密码哈希
    const newPasswordHash = await hashPassword(newPassword);

    // 更新数据库
    await db.update(accounts)
      .set({
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, account.id));

    return NextResponse.json({
      success: true,
      message: '密码修改成功',
    });

  } catch (error: any) {
    console.error('[ChangePassword] 修改密码失败:', error);
    return NextResponse.json(
      { success: false, error: '修改密码失败，请稍后重试' },
      { status: 500 }
    );
  }
}
