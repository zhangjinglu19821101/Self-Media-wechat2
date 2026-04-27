/**
 * 单个素材 API
 * GET    - 获取素材详情
 * PUT    - 更新素材
 * DELETE - 删除素材
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { materialLibrary, materialUsageLog, SYSTEM_WORKSPACE_ID } from '@/lib/db/schema/material-library';
import { eq, desc, sql, and, or } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/materials/[id]
 * 获取素材详情（包含使用记录）
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const workspaceId = await getWorkspaceId(request);

    // 获取素材详情 - 使用sql处理UUID类型 + 可见性：用户workspace OR 系统预置
    const [material] = await db
      .select()
      .from(materialLibrary)
      .where(
        and(
          sql`${materialLibrary.id} = ${id}::uuid`,
          or(
            eq(materialLibrary.workspaceId, workspaceId),
            eq(materialLibrary.workspaceId, SYSTEM_WORKSPACE_ID)
          )
        )
      );

    if (!material) {
      return NextResponse.json({
        success: false,
        error: '素材不存在'
      }, { status: 404 });
    }

    // 获取使用记录（最近10条，表可能不存在需容错）
    let usageLogs: any[] = [];
    try {
      usageLogs = await db
        .select()
        .from(materialUsageLog)
        .where(sql`${materialUsageLog.materialId} = ${id}::uuid`)
        .orderBy(desc(materialUsageLog.createdAt))
        .limit(10);
    } catch {
      // material_usage_log 表可能未创建，忽略错误
    }

    return NextResponse.json({
      success: true,
      data: {
        ...material,
        usageLogs
      }
    });
  } catch (error: any) {
    console.error('[MaterialDetailAPI] GET error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * PUT /api/materials/[id]
 * 更新素材
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();

    // 检查素材是否存在（含可见性：用户workspace OR 系统预置）
    const [existing] = await db
      .select()
      .from(materialLibrary)
      .where(
        and(
          sql`${materialLibrary.id} = ${id}::uuid`,
          or(
            eq(materialLibrary.workspaceId, workspaceId),
            eq(materialLibrary.workspaceId, SYSTEM_WORKSPACE_ID)
          )
        )
      );

    if (!existing) {
      return NextResponse.json({
        success: false,
        error: '素材不存在'
      }, { status: 404 });
    }

    // 系统预置素材禁止修改
    if (existing.workspaceId === SYSTEM_WORKSPACE_ID) {
      return NextResponse.json({
        success: false,
        error: '系统预置素材不可修改'
      }, { status: 403 });
    }

    // 构建更新数据
    const updateData: Record<string, any> = {
      updatedAt: new Date()
    };

    // 可更新字段
    const updatableFields = [
      'title', 'type', 'content',
      'sourceType', 'sourceDesc', 'sourceUrl',
      'topicTags', 'sceneTags', 'emotionTags',
      'applicablePositions', 'status', 'vectorId'
    ];

    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // 执行更新（WHERE 补充 workspaceId，形成双重保护）
    const [updated] = await db
      .update(materialLibrary)
      .set(updateData)
      .where(
        and(
          sql`${materialLibrary.id} = ${id}::uuid`,
          eq(materialLibrary.workspaceId, workspaceId)
        )
      )
      .returning();

    return NextResponse.json({
      success: true,
      data: updated,
      message: '素材更新成功'
    });
  } catch (error: any) {
    console.error('[MaterialDetailAPI] PUT error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

/**
 * DELETE /api/materials/[id]
 * 删除素材（软删除：改为 archived 状态）
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const workspaceId = await getWorkspaceId(request);
    const { searchParams } = new URL(request.url);
    const hard = searchParams.get('hard') === 'true';

    // 检查素材是否存在（含可见性：用户workspace OR 系统预置）
    const [existing] = await db
      .select()
      .from(materialLibrary)
      .where(
        and(
          sql`${materialLibrary.id} = ${id}::uuid`,
          or(
            eq(materialLibrary.workspaceId, workspaceId),
            eq(materialLibrary.workspaceId, SYSTEM_WORKSPACE_ID)
          )
        )
      );

    if (!existing) {
      return NextResponse.json({
        success: false,
        error: '素材不存在'
      }, { status: 404 });
    }

    // 系统预置素材禁止删除
    if (existing.workspaceId === SYSTEM_WORKSPACE_ID) {
      return NextResponse.json({
        success: false,
        error: '系统预置素材不可删除'
      }, { status: 403 });
    }

    if (hard) {
      // 硬删除：真正删除记录（WHERE 补充 workspaceId，形成双重保护）
      await db
        .delete(materialLibrary)
        .where(
          and(
            sql`${materialLibrary.id} = ${id}::uuid`,
            eq(materialLibrary.workspaceId, workspaceId)
          )
        );

      return NextResponse.json({
        success: true,
        message: '素材已永久删除'
      });
    } else {
      // 软删除：改为归档状态（WHERE 补充 workspaceId，形成双重保护）
      await db
        .update(materialLibrary)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(
          and(
            sql`${materialLibrary.id} = ${id}::uuid`,
            eq(materialLibrary.workspaceId, workspaceId)
          )
        );

      return NextResponse.json({
        success: true,
        message: '素材已归档'
      });
    }
  } catch (error: any) {
    console.error('[MaterialDetailAPI] DELETE error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
