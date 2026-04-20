import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { infoSnippets } from '@/lib/db/schema/info-snippets';
import { desc, eq, sql, and, ilike, or } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';
import { snippetDedupService } from '@/lib/services/snippet-dedup-service';

/**
 * GET /api/info-snippets
 * 获取信息速记列表（按 workspaceId 隔离）
 * Query: category, status, search, limit, page
 * 
 * 分类筛选说明：
 * - category 参数会匹配 categories 数组中是否包含该分类（使用 @> 操作符）
 */
export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || '';
    const status = searchParams.get('status') || '';
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const conditions = [eq(infoSnippets.workspaceId, workspaceId)];
    
    // 分类筛选：匹配 categories 数组是否包含指定分类
    if (category && category !== 'all') {
      conditions.push(sql`${infoSnippets.categories} @> ${JSON.stringify([category])}::jsonb`);
    }
    
    if (status && status !== 'all') {
      conditions.push(eq(infoSnippets.status, status));
    }
    if (search) {
      conditions.push(
        or(
          ilike(infoSnippets.title, `%${search}%`),
          ilike(infoSnippets.rawContent, `%${search}%`),
          ilike(infoSnippets.summary, `%${search}%`),
          ilike(infoSnippets.keywords, `%${search}%`)
        )!
      );
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
 * 保存信息速记（用户确认后的数据）
 * 
 * Body: 
 * - rawContent: 原始内容（完整保存，不截断）
 * - categories: 分类标签数组（并列多标签，无主次之分）
 * - title: 标题
 * - sourceOrg: 来源机构
 * - publishDate: 发布时间
 * - url: 原文链接
 * - summary: 摘要
 * - keywords: 关键词
 * - applicableScenes: 适用场景
 * - complianceWarnings: 合规预警（保险类）
 * - complianceLevel: 合规等级（保险类）
 * - materialId: 素材ID
 * - materialStatus: 素材状态
 * - snippetType: memory/reminder
 * - remindAt: 提醒时间
 */
export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();
    const {
      rawContent,
      categories,
      title,
      sourceOrg,
      publishDate,
      url,
      summary,
      keywords,
      applicableScenes,
      complianceWarnings,
      complianceLevel,
      materialId,
      materialStatus,
      snippetType,
      remindAt,
    } = body;

    if (!rawContent?.trim()) {
      return NextResponse.json({ error: '请输入要记录的信息' }, { status: 400 });
    }

    // 提醒类型必须设置提醒时间
    if (snippetType === 'reminder' && !remindAt) {
      return NextResponse.json({ error: '提醒类型必须设置提醒时间' }, { status: 400 });
    }

    const result = await db.insert(infoSnippets).values({
      rawContent: rawContent.trim(),
      categories: categories || ['quick_note'],
      title: title || null,
      sourceOrg: sourceOrg || null,
      publishDate: publishDate || null,
      url: url || null,
      summary: summary || null,
      keywords: keywords || null,
      applicableScenes: applicableScenes || null,
      complianceWarnings: complianceWarnings || null,
      complianceLevel: complianceLevel || null,
      materialId: materialId || null,
      materialStatus: materialStatus || 'draft',
      snippetType: snippetType || 'memory',
      remindAt: remindAt ? new Date(remindAt) : null,
      remindStatus: snippetType === 'reminder' ? 'pending' : null,
      status: 'pending',
      workspaceId,
    }).returning();

    // 🔥 保存/更新哈希记录（关联 snippetId）
    try {
      await snippetDedupService.saveSnippetHash({
        content: rawContent.trim(),
        snippetId: result[0].id,
        workspaceId,
      });
    } catch (hashError) {
      console.error('[info-snippets POST] 保存哈希失败:', hashError);
      // 不阻塞主流程
    }

    return NextResponse.json({
      success: true,
      data: result[0],
    });
  } catch (error: any) {
    console.error('[info-snippets POST] 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
