import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { infoSnippets } from '@/lib/db/schema/info-snippets';
import { eq, and } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';
import { deleteRelatedMaterial } from '@/lib/services/snippet-to-material';

/**
 * GET /api/info-snippets/[id]
 * 获取单个信息速记详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { id } = await params;

    const snippets = await db.select().from(infoSnippets).where(
      and(
        eq(infoSnippets.id, id),
        eq(infoSnippets.workspaceId, workspaceId)
      )
    );

    if (snippets.length === 0) {
      return NextResponse.json({ error: '未找到该速记' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: snippets[0],
    });
  } catch (error: any) {
    console.error('[info-snippets/[id] GET] 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/info-snippets/[id]
 * 更新信息速记
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { id } = await params;
    const body = await request.json();

    // 检查速记是否存在
    const existing = await db.select().from(infoSnippets).where(
      and(
        eq(infoSnippets.id, id),
        eq(infoSnippets.workspaceId, workspaceId)
      )
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: '未找到该速记' }, { status: 404 });
    }

    // 构建更新数据
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    // 只更新提供的字段
    if (body.rawContent !== undefined) updateData.rawContent = body.rawContent;
    if (body.title !== undefined) updateData.title = body.title || null;
    if (body.summary !== undefined) updateData.summary = body.summary || null;
    if (body.keywords !== undefined) updateData.keywords = body.keywords || null;
    if (body.categories !== undefined) updateData.categories = body.categories;
    if (body.applicableScenes !== undefined) updateData.applicableScenes = body.applicableScenes || null;
    if (body.remindAt !== undefined) updateData.remindAt = body.remindAt ? new Date(body.remindAt) : null;
    if (body.remindStatus !== undefined) updateData.remindStatus = body.remindStatus || null;

    const [updated] = await db.update(infoSnippets)
      .set(updateData)
      .where(and(
        eq(infoSnippets.id, id),
        eq(infoSnippets.workspaceId, workspaceId)  // 🔒 写操作也校验 workspaceId
      ))
      .returning();

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error('[info-snippets/[id] PUT] 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/info-snippets/[id]
 * 删除信息速记
 * 
 * 级联删除：如果速记已转化为素材，同步删除素材库记录
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { id } = await params;

    // 使用事务确保数据一致性（级联删除也在事务内）
    const result = await db.transaction(async (tx) => {
      // 查询速记（带 workspaceId 隔离）
      const snippets = await tx.select().from(infoSnippets).where(
        and(
          eq(infoSnippets.id, id),
          eq(infoSnippets.workspaceId, workspaceId)
        )
      );

      if (snippets.length === 0) {
        throw new Error('NOT_FOUND');
      }

      const snippet = snippets[0];
      const materialId = snippet.materialId;

      // 删除速记记录
      await tx.delete(infoSnippets).where(eq(infoSnippets.id, id));

      // 级联删除关联素材（在事务内，确保一致性）
      if (materialId) {
        await deleteRelatedMaterial(materialId, tx);
      }

      return { snippet, materialId };
    });

    console.log(`[info-snippets/[id] DELETE] 删除速记 ${id}${result.materialId ? ` 及关联素材 ${result.materialId}` : ''}`);

    return NextResponse.json({
      success: true,
      data: {
        id,
        deletedMaterialId: result.materialId,
        message: '删除成功',
      },
    });
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: '未找到该速记' }, { status: 404 });
    }
    console.error('[info-snippets/[id] DELETE] 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
