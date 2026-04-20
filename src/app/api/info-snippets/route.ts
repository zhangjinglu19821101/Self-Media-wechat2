import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { infoSnippets } from '@/lib/db/schema/info-snippets';
import { desc, eq, like, sql, and } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';

/**
 * GET /api/info-snippets
 * 获取信息速记列表（按 workspaceId 隔离）
 * Query: status=pending|organized, snippetType=memory|reminder, search=关键词, limit=20, page=1
 */
export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const snippetType = searchParams.get('snippetType') || '';
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const conditions = [eq(infoSnippets.workspaceId, workspaceId)];
    if (status) {
      conditions.push(eq(infoSnippets.status, status));
    }
    if (snippetType) {
      conditions.push(eq(infoSnippets.snippetType, snippetType));
    }
    if (search) {
      conditions.push(sql`(${infoSnippets.title} ILIKE ${'%' + search + '%'} OR ${infoSnippets.sourceOrg} ILIKE ${'%' + search + '%'} OR ${infoSnippets.highlights} ILIKE ${'%' + search + '%'})`);
    }

    const whereClause = conditions.reduce((acc, cond) => sql`${acc} AND ${cond}`);

    // 查询总数
    const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(infoSnippets).where(whereClause);
    const total = countResult[0]?.count || 0;

    // 查询数据
    const data = await db.select().from(infoSnippets)
      .where(whereClause)
      .orderBy(desc(infoSnippets.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    return NextResponse.json({
      success: true,
      data: {
        list: data,
        pagination: {
          page,
          pageSize: limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error('[info-snippets GET] 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/info-snippets
 * 快速创建一条信息速记（按 workspaceId 隔离）
 * Body: title, sourceOrg, publishDate, url, highlights, snippetType, remindAt
 */
export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();
    const { title, sourceOrg, publishDate, url, highlights, snippetType, remindAt } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: '请输入报告/信息名称' }, { status: 400 });
    }
    if (!sourceOrg?.trim()) {
      return NextResponse.json({ error: '请输入发布机构' }, { status: 400 });
    }
    if (!highlights?.trim()) {
      return NextResponse.json({ error: '请输入核心亮点' }, { status: 400 });
    }

    // 提醒类型必须设置提醒时间
    if (snippetType === 'reminder' && !remindAt) {
      return NextResponse.json({ error: '提醒类型必须设置提醒时间' }, { status: 400 });
    }

    const result = await db.insert(infoSnippets).values({
      title: title.trim(),
      sourceOrg: sourceOrg.trim(),
      publishDate: publishDate?.trim() || null,
      url: url?.trim() || null,
      highlights: highlights.trim(),
      snippetType: snippetType || 'memory',
      remindAt: remindAt ? new Date(remindAt) : null,
      remindStatus: snippetType === 'reminder' ? 'pending' : null,
      status: 'pending',
      workspaceId,
    }).returning();

    return NextResponse.json({
      success: true,
      data: result[0],
    });
  } catch (error: any) {
    console.error('[info-snippets POST] 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
