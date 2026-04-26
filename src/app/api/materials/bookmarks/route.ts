/**
 * 素材收藏 API
 * POST   - 收藏素材
 * DELETE - 取消收藏
 * GET    - 检查收藏状态
 * 
 * 权限控制：
 * - 用户只能收藏自己可见的素材（系统素材 + 自己的素材）
 * - 收藏记录绑定 workspaceId
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { materialLibrary, materialBookmarks } from '@/lib/db/schema/material-library';
import { eq, sql, and } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';

/**
 * GET /api/materials/bookmarks?materialId=xxx
 * 检查素材是否已收藏
 */
export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { searchParams } = new URL(request.url);
    const materialId = searchParams.get('materialId');

    if (!materialId) {
      return NextResponse.json({
        success: false,
        error: '缺少 materialId 参数'
      }, { status: 400 });
    }

    const [bookmark] = await db
      .select()
      .from(materialBookmarks)
      .where(
        and(
          eq(materialBookmarks.materialId, sql`${materialId}::uuid`),
          eq(materialBookmarks.workspaceId, workspaceId)
        )
      );

    return NextResponse.json({
      success: true,
      data: {
        isBookmarked: !!bookmark,
        bookmark: bookmark || null,
      }
    });
  } catch (error: any) {
    console.error('[BookmarksAPI] GET error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * POST /api/materials/bookmarks
 * 收藏素材
 * 
 * Body:
 * - materialId: 素材ID（必须）
 * - userTags: 用户自定义标签[]
 * - notes: 备注
 */
export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();
    const { materialId, userTags = [], notes = '' } = body;

    if (!materialId) {
      return NextResponse.json({
        success: false,
        error: '缺少 materialId 参数'
      }, { status: 400 });
    }

    // 验证素材存在且用户可见
    const [material] = await db
      .select()
      .from(materialLibrary)
      .where(sql`${materialLibrary.id} = ${materialId}::uuid`);

    if (!material) {
      return NextResponse.json({
        success: false,
        error: '素材不存在'
      }, { status: 404 });
    }

    // 权限校验：用户素材仅所有者可收藏
    if (material.ownerType === 'user' && material.workspaceId !== workspaceId) {
      return NextResponse.json({
        success: false,
        error: '素材不存在'
      }, { status: 404 });
    }

    // 检查是否已收藏（幂等）
    const [existing] = await db
      .select()
      .from(materialBookmarks)
      .where(
        and(
          eq(materialBookmarks.materialId, sql`${materialId}::uuid`),
          eq(materialBookmarks.workspaceId, workspaceId)
        )
      );

    if (existing) {
      // 已收藏，更新标签和备注
      const [updated] = await db
        .update(materialBookmarks)
        .set({
          userTags,
          notes,
        })
        .where(eq(materialBookmarks.id, existing.id))
        .returning();

      return NextResponse.json({
        success: true,
        data: updated,
        message: '收藏已更新'
      });
    }

    // 新增收藏
    const [bookmark] = await db
      .insert(materialBookmarks)
      .values({
        materialId: sql`${materialId}::uuid`,
        workspaceId,
        userTags,
        notes,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: bookmark,
      message: '收藏成功'
    });
  } catch (error: any) {
    console.error('[BookmarksAPI] POST error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * DELETE /api/materials/bookmarks?materialId=xxx
 * 取消收藏
 */
export async function DELETE(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { searchParams } = new URL(request.url);
    const materialId = searchParams.get('materialId');

    if (!materialId) {
      return NextResponse.json({
        success: false,
        error: '缺少 materialId 参数'
      }, { status: 400 });
    }

    // 删除收藏记录
    const result = await db
      .delete(materialBookmarks)
      .where(
        and(
          eq(materialBookmarks.materialId, sql`${materialId}::uuid`),
          eq(materialBookmarks.workspaceId, workspaceId)
        )
      );

    return NextResponse.json({
      success: true,
      message: '已取消收藏'
    });
  } catch (error: any) {
    console.error('[BookmarksAPI] DELETE error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
