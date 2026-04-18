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
import { isSuperAdmin } from '@/lib/auth/context';
import { hashPassword } from '@/lib/auth/password';

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

    // 2. 解析请求
    const body = await request.json();
    const { action, accountId, data } = body;

    if (!action || !accountId) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    // 3. 执行操作
    let result: any = {};

    switch (action) {
      case 'disable': {
        // 禁用账号
        await db
          .update(accounts)
          .set({ status: 'disabled', updatedAt: new Date() })
          .where(eq(accounts.id, accountId));
        result = { message: '账号已禁用' };
        break;
      }

      case 'enable': {
        // 启用账号
        await db
          .update(accounts)
          .set({ 
            status: 'active', 
            failedLoginAttempts: 0,
            lockedUntil: null,
            updatedAt: new Date() 
          })
          .where(eq(accounts.id, accountId));
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
        
        result = { message: '密码已重置', newPassword };
        break;
      }

      case 'set_role': {
        // 设置角色
        const newRole = data?.role;
        if (!['super_admin', 'normal'].includes(newRole)) {
          return NextResponse.json({ error: '无效的角色' }, { status: 400 });
        }
        
        await db
          .update(accounts)
          .set({ role: newRole, updatedAt: new Date() })
          .where(eq(accounts.id, accountId));
        
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
 * 生成随机密码
 */
function generateRandomPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
