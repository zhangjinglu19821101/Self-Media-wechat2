import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { infoSnippets } from '@/lib/db/schema/info-snippets';
import { eq, sql, and } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';

/**
 * GET /api/info-snippets/[id]
 * 获取单条速记详情（按 workspaceId 隔离）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { id } = await params;
    const result = await db.select().from(infoSnippets).where(
      and(
        eq(infoSnippets.id, id),
        eq(infoSnippets.workspaceId, workspaceId)
      )
    );

    if (result.length === 0) {
      return NextResponse.json({ error: '未找到该记录' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result[0],
    });
  } catch (error: any) {
    console.error('[info-snippet GET] 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/info-snippets/[id]
 * 更新速记（按 workspaceId 隔离）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { id } = await params;
    const body = await request.json();
    
    const result = await db.update(infoSnippets).set({
      title: body.title,
      sourceOrg: body.sourceOrg,
      publishDate: body.publishDate || null,
      url: body.url || null,
      highlights: body.highlights,
      status: body.status || 'pending',
      // 🔥 提醒相关字段
      snippetType: body.snippetType || null,
      remindAt: body.remindAt ? new Date(body.remindAt) : null,
      remindStatus: body.remindStatus || null,
      remindedAt: body.remindedAt === null ? null : (body.remindedAt ? new Date(body.remindedAt) : undefined),
      updatedAt: new Date(),
    }).where(
      and(
        eq(infoSnippets.id, id),
        eq(infoSnippets.workspaceId, workspaceId)
      )
    ).returning();

    if (result.length === 0) {
      return NextResponse.json({ error: '未找到该记录' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result[0],
    });
  } catch (error: any) {
    console.error('[info-snippet PUT] 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/info-snippets/[id]
 * 删除速记（按 workspaceId 隔离）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { id } = await params;
    
    const result = await db.delete(infoSnippets).where(
      and(
        eq(infoSnippets.id, id),
        eq(infoSnippets.workspaceId, workspaceId)
      )
    ).returning();

    if (result.length === 0) {
      return NextResponse.json({ error: '未找到该记录' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: '已删除',
    });
  } catch (error: any) {
    console.error('[info-snippet DELETE] 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
