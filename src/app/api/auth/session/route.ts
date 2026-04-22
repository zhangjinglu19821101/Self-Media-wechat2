/**
 * 获取当前用户 session 信息 API 路由
 * 
 * GET /api/auth/session
 * 功能：返回当前登录用户的详细信息（用于账户设置页面）
 * 
 * 安全特性：
 * - 只返回必要的非敏感字段
 * - 不返回 passwordHash 等敏感字段
 * - 支持可选脱敏（用于日志等场景）
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { accounts } from '@/lib/db/schema/auth';
import { eq } from 'drizzle-orm';

/**
 * 邮箱脱敏（用于日志等场景）
 * 例如：zhangsan@example.com → zha***@example.com
 * 
 * 注意：此函数仅供本文件内部使用，不导出
 */
function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!domain) return email;
  
  // 保留前3个字符，其余用 * 替代
  const maskedLocal = localPart.length > 3 
    ? localPart.substring(0, 3) + '***'
    : localPart.substring(0, 1) + '***';
  
  return `${maskedLocal}@${domain}`;
}

/**
 * 用户信息响应接口
 */
interface UserInfoResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
}

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
    // 安全原则：只选择需要的字段，不选择 passwordHash 等敏感字段
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

    // 检查是否需要脱敏（通过查询参数控制）
    const url = new URL(request.url);
    const shouldMask = url.searchParams.get('mask') === 'true';

    // 构建响应
    const userInfo: UserInfoResponse = {
      id: account.id,
      email: shouldMask ? maskEmail(account.email) : account.email,
      name: account.name,
      role: account.role,
      createdAt: account.createdAt?.toISOString() || new Date().toISOString(),
      lastLoginAt: account.lastLoginAt?.toISOString() || null,
    };

    return NextResponse.json({
      success: true,
      data: userInfo,
    });

  } catch (error: any) {
    // 日志中不记录敏感信息
    console.error('[SessionAPI] 获取用户信息失败');
    return NextResponse.json(
      { success: false, error: '获取用户信息失败' },
      { status: 500 }
    );
  }
}
