/**
 * 超级管理员 - 机构管理 API
 * 
 * GET  /api/admin/workspaces - 获取所有机构列表
 * POST /api/admin/workspaces - 操作机构（禁用/启用）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { workspaces, workspaceMembers, accounts } from '@/lib/db/schema/auth';
import { desc, like, and, eq, sql } from 'drizzle-orm';
import { isSuperAdmin } from '@/lib/auth/context';

/**
 * GET /api/admin/workspaces
 * 获取所有机构列表
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
    const type = searchParams.get('type') || '';
    const status = searchParams.get('status') || '';

    // 3. 构建查询条件
    const conditions = [];
    if (search) {
      conditions.push(like(workspaces.name, `%${search}%`));
    }
    if (type) {
      conditions.push(eq(workspaces.type, type));
    }
    if (status) {
      conditions.push(eq(workspaces.status, status));
    }

    // 4. 查询机构列表
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const list = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        type: workspaces.type,
        status: workspaces.status,
        llmKeySource: workspaces.llmKeySource,
        createdAt: workspaces.createdAt,
      })
      .from(workspaces)
      .where(whereClause)
      .orderBy(desc(workspaces.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // 5. 查询总数
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(workspaces)
      .where(whereClause);
    const total = Number(countResult[0]?.count || 0);

    // 6. 查询每个机构的成员数和所有者
    const workspaceIds = list.map(w => w.id);
    let memberCounts: Record<string, number> = {};
    let ownerMap: Record<string, { id: string; name: string; email: string }> = {};
    
    if (workspaceIds.length > 0) {
      // 成员数
      const counts = await db
        .select({
          workspaceId: workspaceMembers.workspaceId,
          count: sql<number>`count(*)`,
        })
        .from(workspaceMembers)
        .where(sql`${workspaceMembers.workspaceId} IN ${workspaceIds}`)
        .groupBy(workspaceMembers.workspaceId);
      
      memberCounts = Object.fromEntries(
        counts.map(c => [c.workspaceId, Number(c.count)])
      );

      // 所有者
      const owners = await db
        .select({
          workspaceId: workspaceMembers.workspaceId,
          accountId: workspaceMembers.accountId,
          accountName: accounts.name,
          accountEmail: accounts.email,
        })
        .from(workspaceMembers)
        .innerJoin(accounts, eq(workspaceMembers.accountId, accounts.id))
        .where(
          and(
            sql`${workspaceMembers.workspaceId} IN ${workspaceIds}`,
            eq(workspaceMembers.role, 'owner')
          )
        );
      
      ownerMap = Object.fromEntries(
        owners.map(o => [o.workspaceId, { id: o.accountId, name: o.accountName, email: o.accountEmail }])
      );
    }

    // 7. 组装结果
    const result = list.map(w => ({
      ...w,
      memberCount: memberCounts[w.id] || 0,
      owner: ownerMap[w.id] || null,
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
    console.error('[Admin] 获取机构列表失败:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * POST /api/admin/workspaces
 * 操作机构：禁用/启用
 * 
 * Body: { action: 'disable' | 'enable', workspaceId: string }
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
    const { action, workspaceId } = body;

    if (!action || !workspaceId) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    // 3. 执行操作
    let result: Record<string, string> = {};

    switch (action) {
      case 'disable': {
        // 禁用机构
        await db
          .update(workspaces)
          .set({ status: 'disabled', updatedAt: new Date() })
          .where(eq(workspaces.id, workspaceId));
        result = { message: '机构已禁用' };
        break;
      }

      case 'enable': {
        // 启用机构
        await db
          .update(workspaces)
          .set({ status: 'active', updatedAt: new Date() })
          .where(eq(workspaces.id, workspaceId));
        result = { message: '机构已启用' };
        break;
      }

      case 'set_key_source': {
        // 设置 LLM Key 来源策略
        const keySource = body.keySource as string;
        if (keySource !== 'platform_credits' && keySource !== 'user_key') {
          return NextResponse.json({ error: '无效的 keySource 值，仅支持 platform_credits 或 user_key' }, { status: 400 });
        }
        await db
          .update(workspaces)
          .set({ llmKeySource: keySource, updatedAt: new Date() })
          .where(eq(workspaces.id, workspaceId));

        // 清理 factory 缓存，确保立即生效
        const { invalidateClientCache } = await import('@/lib/llm/factory');
        invalidateClientCache(workspaceId);

        result = { message: `Key 来源已切换为：${keySource === 'platform_credits' ? '平台积分' : '自有 Key'}` };
        break;
      }

      default:
        return NextResponse.json({ error: '未知操作' }, { status: 400 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[Admin] 操作机构失败:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
