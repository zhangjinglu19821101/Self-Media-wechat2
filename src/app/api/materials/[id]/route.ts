/**
 * 单个素材 API
 * GET    - 获取素材详情
 * PUT    - 更新素材
 * DELETE - 删除素材
 * 
 * 权限控制：
 * - 系统素材：仅管理员可编辑/删除
 * - 用户素材：仅素材所有者可编辑/删除
 * - 读取：系统素材所有人可见，用户素材仅所有者可见
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { materialLibrary, materialUsageLog } from '@/lib/db/schema/material-library';
import { eq, desc, sql, and } from 'drizzle-orm';
import { getWorkspaceId, isSuperAdmin } from '@/lib/auth/context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 获取素材详情（含权限校验）
 * 系统素材所有人可见，用户素材仅所有者可见
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const workspaceId = await getWorkspaceId(request);

    // 获取素材详情
    const [material] = await db
      .select()
      .from(materialLibrary)
      .where(sql`${materialLibrary.id} = ${id}::uuid`);

    if (!material) {
      return NextResponse.json({
        success: false,
        error: '素材不存在'
      }, { status: 404 });
    }

    // 权限校验：用户素材仅所有者可见
    if (material.ownerType === 'user' && material.workspaceId !== workspaceId) {
      return NextResponse.json({
        success: false,
        error: '素材不存在'
      }, { status: 404 });
    }

    // 获取使用记录（最近10条）
    const usageLogs = await db
      .select()
      .from(materialUsageLog)
      .where(sql`${materialUsageLog.materialId} = ${id}::uuid`)
      .orderBy(desc(materialUsageLog.createdAt))
      .limit(10);

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
 * 更新素材（含权限校验）
 * 系统素材：仅管理员
 * 用户素材：仅所有者
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const workspaceId = await getWorkspaceId(request);
    const adminFlag = await isSuperAdmin(request);
    const body = await request.json();

    // 获取素材
    const [existing] = await db
      .select()
      .from(materialLibrary)
      .where(sql`${materialLibrary.id} = ${id}::uuid`);

    if (!existing) {
      return NextResponse.json({
        success: false,
        error: '素材不存在'
      }, { status: 404 });
    }

    // ─── 权限校验 ───
    if (existing.ownerType === 'system') {
      // 系统素材：仅管理员可编辑
      if (!adminFlag) {
        return NextResponse.json({
          success: false,
          error: '权限不足：仅管理员可编辑系统素材'
        }, { status: 403 });
      }
    } else {
      // 用户素材：仅所有者可编辑
      if (existing.workspaceId !== workspaceId) {
        return NextResponse.json({
          success: false,
          error: '素材不存在'
        }, { status: 404 });
      }
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
      'applicablePositions', 'status', 'vectorId',
      'industry', 'sourceArticleId', 'sceneType', 'analysisText'
    ];

    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // 管理员可修改 ownerType
    if (body.ownerType !== undefined && adminFlag) {
      const validOwnerTypes = ['system', 'user'];
      if (!validOwnerTypes.includes(body.ownerType)) {
        return NextResponse.json({
          success: false,
          error: `无效的归属类型，有效值为：${validOwnerTypes.join(', ')}`
        }, { status: 400 });
      }
      updateData['ownerType'] = body.ownerType;
      // 如果切换为系统素材，清除 workspaceId
      if (body.ownerType === 'system') {
        updateData['workspaceId'] = null;
      } else {
        updateData['workspaceId'] = workspaceId;
      }
    }

    // 执行更新
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
 * 删除素材（含权限校验）
 * 系统素材：仅管理员
 * 用户素材：仅所有者
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const workspaceId = await getWorkspaceId(request);
    const adminFlag = await isSuperAdmin(request);
    const { searchParams } = new URL(request.url);
    const hard = searchParams.get('hard') === 'true';

    // 获取素材
    const [existing] = await db
      .select()
      .from(materialLibrary)
      .where(sql`${materialLibrary.id} = ${id}::uuid`);

    if (!existing) {
      return NextResponse.json({
        success: false,
        error: '素材不存在'
      }, { status: 404 });
    }

    // ─── 权限校验 ───
    if (existing.ownerType === 'system') {
      // 系统素材：仅管理员可删除
      if (!adminFlag) {
        return NextResponse.json({
          success: false,
          error: '权限不足：仅管理员可删除系统素材'
        }, { status: 403 });
      }
    } else {
      // 用户素材：仅所有者可删除
      if (existing.workspaceId !== workspaceId) {
        return NextResponse.json({
          success: false,
          error: '素材不存在'
        }, { status: 404 });
      }
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
