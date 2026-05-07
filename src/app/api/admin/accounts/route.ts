/**
 * 超级管理员 - 用户管理 API
 * 
 * GET  /api/admin/accounts - 获取所有用户列表
 * POST /api/admin/accounts - 操作用户（禁用/启用/重置密码/设置角色）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { accounts, workspaces, workspaceMembers } from '@/lib/db/schema/auth';
import { eq, desc, like, or, and, sql } from 'drizzle-orm';
import { isSuperAdmin, getAccountId } from '@/lib/auth/context';
import { hashPassword } from '@/lib/auth/password';
import { randomBytes } from 'crypto';
import { adminAuditLogs, ADMIN_ACTION } from '@/lib/db/schema/admin-audit-logs';
import { log } from '@/lib/logger';

/**
 * 记录管理员操作审计日志
 */
async function createAuditLog(params: {
  adminId: string;
  adminEmail: string;
  targetAccountId: string;
  targetEmail: string;
  action: string;
  actionDetail?: string;
  previousValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await db.insert(adminAuditLogs).values({
      adminId: params.adminId,
      adminEmail: params.adminEmail,
      targetAccountId: params.targetAccountId,
      targetEmail: params.targetEmail,
      action: params.action,
      actionDetail: params.actionDetail,
      previousValue: params.previousValue,
      newValue: params.newValue,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
    log.info('[AdminAudit]', `${params.adminEmail} 执行了 ${params.action} 操作，目标用户: ${params.targetEmail}`);
  } catch (error) {
    log.error('[AdminAudit]', '写入审计日志失败:', error);
  }
}

/**
 * GET /api/admin/accounts
 * 获取所有用户列表
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 权限检查
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: '需要超级管理员权限' }, { status: 403 });
    }

    // 2. 解析查询参数
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || ''; // active / disabled / suspended

    // 3. 构建查询条件
    const conditions = [];
    if (search) {
      conditions.push(
        or(
          like(accounts.email, `%${search}%`),
          like(accounts.name, `%${search}%`)
        )
      );
    }
    if (status) {
      conditions.push(eq(accounts.status, status));
    }

    // 4. 查询用户列表
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const users = await db
      .select({
        id: accounts.id,
        email: accounts.email,
        name: accounts.name,
        role: accounts.role,
        status: accounts.status,
        createdAt: accounts.createdAt,
        lastLoginAt: accounts.lastLoginAt,
        failedLoginAttempts: accounts.failedLoginAttempts,
        lockedUntil: accounts.lockedUntil,
      })
      .from(accounts)
      .where(whereClause)
      .orderBy(desc(accounts.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // 5. 查询总数
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(accounts)
      .where(whereClause);
    const total = Number(countResult[0]?.count || 0);

    // 6. 查询每个用户的 workspace 数量
    const userIds = users.map(u => u.id);
    let workspaceCounts: Record<string, number> = {};
    
    if (userIds.length > 0) {
      const memberCounts = await db
        .select({
          accountId: workspaceMembers.accountId,
          count: sql<number>`count(*)`,
        })
        .from(workspaceMembers)
        .where(sql`${workspaceMembers.accountId} IN ${userIds}`)
        .groupBy(workspaceMembers.accountId);
      
      workspaceCounts = Object.fromEntries(
        memberCounts.map(m => [m.accountId, Number(m.count)])
      );
    }

    // 7. 组装结果
    const result = users.map(u => ({
      ...u,
      workspaceCount: workspaceCounts[u.id] || 0,
    }));

    return NextResponse.json({
      success: true,
      data: result,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('[Admin] 获取用户列表失败:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * POST /api/admin/accounts
 * 操作用户：禁用/启用/重置密码/设置角色
 * 
 * Body: { action: 'disable' | 'enable' | 'reset_password' | 'set_role', accountId: string, data?: any }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 权限检查
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: '需要超级管理员权限' }, { status: 403 });
    }

    // 2. 获取当前用户信息（用于自我保护和审计日志）
    const currentUserId = await getAccountId();
    const currentUserEmail = await (async () => {
      const { getServerSession } = await import('next-auth');
      const { authOptions } = await import('@/lib/auth');
      const session = await getServerSession(authOptions);
      return session?.user?.email || 'unknown';
    })();

    // 3. 解析请求
    const body = await request.json();
    const { action, accountId, data } = body;

    if (!action || !accountId) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    // 4. 获取目标用户信息（用于审计日志）
    const targetUser = await db.select({
      id: accounts.id,
      email: accounts.email,
      name: accounts.name,
      role: accounts.role,
      status: accounts.status,
    }).from(accounts).where(eq(accounts.id, accountId)).limit(1);

    if (targetUser.length === 0) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }
    const target = targetUser[0];

    // 5. 自我保护：禁止操作自己
    const selfProtectedActions = ['disable', 'reset_password', 'set_role'];
    if (currentUserId && accountId === currentUserId && selfProtectedActions.includes(action)) {
      return NextResponse.json({ error: '不能对自己执行此操作' }, { status: 400 });
    }

    // 6. 获取请求元数据
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // 7. 执行操作
    let result: any = {};

    switch (action) {
      case 'disable': {
        // 禁用账号
        const previousValue = { status: target.status };
        await db
          .update(accounts)
          .set({ status: 'disabled', updatedAt: new Date() })
          .where(eq(accounts.id, accountId));
        
        await createAuditLog({
          adminId: currentUserId || 'unknown',
          adminEmail: currentUserEmail,
          targetAccountId: accountId,
          targetEmail: target.email,
          action: ADMIN_ACTION.DISABLE,
          actionDetail: `管理员 ${currentUserEmail} 禁用了用户 ${target.email}`,
          previousValue,
          newValue: { status: 'disabled' },
          ipAddress,
          userAgent,
        });
        
        result = { message: '账号已禁用' };
        break;
      }

      case 'enable': {
        // 启用账号
        const previousValue = { status: target.status, failedLoginAttempts: target.status };
        await db
          .update(accounts)
          .set({ 
            status: 'active', 
            failedLoginAttempts: 0,
            lockedUntil: null,
            updatedAt: new Date() 
          })
          .where(eq(accounts.id, accountId));
        
        await createAuditLog({
          adminId: currentUserId || 'unknown',
          adminEmail: currentUserEmail,
          targetAccountId: accountId,
          targetEmail: target.email,
          action: ADMIN_ACTION.ENABLE,
          actionDetail: `管理员 ${currentUserEmail} 启用了用户 ${target.email}`,
          previousValue,
          newValue: { status: 'active', failedLoginAttempts: 0, lockedUntil: null },
          ipAddress,
          userAgent,
        });
        
        result = { message: '账号已启用' };
        break;
      }

      case 'reset_password': {
        // 重置密码为指定值或随机值
        const newPassword = data?.password || generateRandomPassword();
        const passwordHash = await hashPassword(newPassword);
        
        await db
          .update(accounts)
          .set({ 
            passwordHash, 
            failedLoginAttempts: 0,
            lockedUntil: null,
            updatedAt: new Date() 
          })
          .where(eq(accounts.id, accountId));
        
        await createAuditLog({
          adminId: currentUserId || 'unknown',
          adminEmail: currentUserEmail,
          targetAccountId: accountId,
          targetEmail: target.email,
          action: ADMIN_ACTION.RESET_PASSWORD,
          actionDetail: `管理员 ${currentUserEmail} 重置了用户 ${target.email} 的密码`,
          ipAddress,
          userAgent,
        });
        
        result = { message: '密码已重置', newPassword };
        break;
      }

      case 'unlock': {
        // 解锁账号（只清除锁定状态，不重置密码）
        await db
          .update(accounts)
          .set({ 
            failedLoginAttempts: 0,
            lockedUntil: null,
            updatedAt: new Date() 
          })
          .where(eq(accounts.id, accountId));
        
        await createAuditLog({
          adminId: currentUserId || 'unknown',
          adminEmail: currentUserEmail,
          targetAccountId: accountId,
          targetEmail: target.email,
          action: ADMIN_ACTION.UNLOCK,
          actionDetail: `管理员 ${currentUserEmail} 解锁了用户 ${target.email}`,
          ipAddress,
          userAgent,
        });
        
        result = { message: '账号已解锁', user: target };
        break;
      }

      case 'set_role': {
        // 设置角色
        const newRole = data?.role;
        if (!['super_admin', 'normal'].includes(newRole)) {
          return NextResponse.json({ error: '无效的角色' }, { status: 400 });
        }
        
        const previousValue = { role: target.role };
        await db
          .update(accounts)
          .set({ role: newRole, updatedAt: new Date() })
          .where(eq(accounts.id, accountId));
        
        await createAuditLog({
          adminId: currentUserId || 'unknown',
          adminEmail: currentUserEmail,
          targetAccountId: accountId,
          targetEmail: target.email,
          action: ADMIN_ACTION.SET_ROLE,
          actionDetail: `管理员 ${currentUserEmail} 将用户 ${target.email} 的角色从 ${target.role} 改为 ${newRole}`,
          previousValue,
          newValue: { role: newRole },
          ipAddress,
          userAgent,
        });
        
        result = { message: `角色已设置为 ${newRole}` };
        break;
      }

      default:
        return NextResponse.json({ error: '未知操作' }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[Admin] 操作用户失败:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * 生成随机密码（使用加密安全随机数）
 */
function generateRandomPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const charsLength = chars.length;
  const randomBytesBuffer = randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(randomBytesBuffer[i] % charsLength);
  }
  return password;
}
