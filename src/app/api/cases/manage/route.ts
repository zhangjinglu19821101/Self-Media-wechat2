import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { eq, and, or, ilike, sql, desc } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';

// GET /api/cases/manage - 查询案例素材列表（从 material_library 查询 type='case'）
export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    const keyword = searchParams.get('keyword') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // 构建筛选条件：只查 case 类型素材
    const conditions = [
      eq(materialLibrary.type, 'case'),
      or(
        eq(materialLibrary.ownerType, 'system'),
        eq(materialLibrary.workspaceId, workspaceId)
      )!
    ];

    if (keyword) {
      conditions.push(
        or(
          ilike(materialLibrary.title, `%${keyword}%`),
          ilike(materialLibrary.content, `%${keyword}%`)
        )!
      );
    }

    // 查询总数
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(materialLibrary)
      .where(and(...conditions));
    const total = Number(countResult[0]?.count || 0);

    // 查询数据
    const offset = (page - 1) * pageSize;
    const materials = await db
      .select()
      .from(materialLibrary)
      .where(and(...conditions))
      .orderBy(desc(materialLibrary.createdAt))
      .limit(pageSize)
      .offset(offset);

    // 转换为案例格式（兼容前端）
    const cases = materials.map(m => ({
      id: m.id,
      title: m.title,
      background: m.content,
      insuranceAction: m.sceneTags?.[0] || '',
      result: '',
      productTags: m.topicTags || [],
      crowdTags: [],
      emotionTags: m.emotionTags || [],
      useCount: 0,
      sourceType: m.sourceType,
      ownerType: m.ownerType,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));

    // 统计概览
    const stats = await db
      .select({
        total: sql<number>`count(*)`,
      })
      .from(materialLibrary)
      .where(
        and(
          eq(materialLibrary.type, 'case'),
          or(
            eq(materialLibrary.ownerType, 'system'),
            eq(materialLibrary.workspaceId, workspaceId)
          )!
        )
      );

    return NextResponse.json({
      cases,
      total,
      page,
      pageSize,
      stats: {
        total: stats[0]?.total || 0,
      },
    });
  } catch (error) {
    console.error('查询案例素材列表失败:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
