/**
 * 修改密码 API 路由
 * 
 * POST /api/auth/change-password
 * 功能：验证当前密码，修改为新密码
 * 
 * 安全特性：
 * - Rate Limiting：防止暴力破解
 * - 密码强度校验
 * - 审计日志
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema/auth';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword, validatePasswordStrength } from '@/lib/auth/password';
import { passwordRateLimiter } from '@/lib/rate-limiter';

/**
 * 获取客户端 IP
 */
function getClientIP(request: NextRequest): string {
  // 优先检查代理头
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    // 取第一个 IP（最原始的客户端 IP）
    return xForwardedFor.split(',')[0].trim();
  }
  
  const xRealIP = request.headers.get('x-real-ip');
  if (xRealIP) {
    return xRealIP.trim();
  }
  
  // 默认返回 unknown（用于本地开发）
  return 'unknown';
}

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

    const accountId = session.user.id;
    const clientIP = getClientIP(request);

    // P0: 检查限流状态
    const rateLimitCheck = passwordRateLimiter.check(accountId, clientIP);
    if (rateLimitCheck.locked) {
      console.warn(`[ChangePassword] 账户 ${accountId} 已被锁定，IP: ${clientIP}`);
      return NextResponse.json(
        { 
          success: false, 
          error: rateLimitCheck.message || '账户已锁定，请稍后重试',
          locked: true,
          remainingMs: rateLimitCheck.remainingMs,
        },
        { status: 429 } // Too Many Requests
      );
    }

    // 解析请求体
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // 验证输入
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: '请提供当前密码和新密码', attemptsLeft: rateLimitCheck.attemptsLeft },
        { status: 400 }
      );
    }

    // 验证新密码强度
    const strengthCheck = validatePasswordStrength(newPassword);
    if (!strengthCheck.valid) {
      return NextResponse.json(
        { success: false, error: strengthCheck.message, attemptsLeft: rateLimitCheck.attemptsLeft },
        { status: 400 }
      );
    }

    // 查询用户
    const [account] = await db.select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
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
      // P0: 记录失败
      passwordRateLimiter.recordFailure(accountId, clientIP);
      const newRateLimitCheck = passwordRateLimiter.check(accountId, clientIP);
      
      console.warn(`[ChangePassword] 密码验证失败，账户: ${accountId}, IP: ${clientIP}, 剩余次数: ${newRateLimitCheck.attemptsLeft}`);
      
      return NextResponse.json(
        { 
          success: false, 
          error: '当前密码错误',
          attemptsLeft: newRateLimitCheck.attemptsLeft,
          willLock: newRateLimitCheck.attemptsLeft <= 1,
        },
        { status: 401 }
      );
    }

    // 检查新密码是否与当前密码相同（使用字符串比较而非哈希比较）
    // 注意：这里直接比较明文，因为用户输入的就是明文
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { success: false, error: '新密码不能与当前密码相同', attemptsLeft: rateLimitCheck.attemptsLeft },
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

    // P0: 记录成功（清除失败记录）
    passwordRateLimiter.recordSuccess(accountId);

    // 审计日志
    console.log(`[ChangePassword] 密码修改成功，账户: ${account.email} (${accountId}), IP: ${clientIP}, 时间: ${new Date().toISOString()}`);

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
