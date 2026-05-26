import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { getWorkspaceId } from '@/lib/auth/context';
import { and, eq, or } from 'drizzle-orm';
import { formatMaterialAsItem, is7DMaterialType } from '@/lib/utils/material-formatter';

/**
 * GET /api/cases/[id]
 * 根据 ID 获取素材详情（从 material_library 查询）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspaceId = await getWorkspaceId(request);
    if (!workspaceId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const result = await db
      .select()
      .from(materialLibrary)
      .where(
        and(
          eq(materialLibrary.id, id),
          or(
            eq(materialLibrary.ownerType, 'system'),
            eq(materialLibrary.workspaceId, workspaceId)
          )
        )
      )
      .limit(1);

    if (!result[0]) {
      return NextResponse.json({ error: '素材不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: formatMaterialAsItem(result[0]) });
  } catch (error) {
    console.error('[cases/[id] GET] 查询失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/cases/[id]
 * 更新素材内容（更新 material_library）
 * 注意：7维素材的 content 是纯文本，不能用结构化标记重建
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();

    // 1. 查询素材，校验权限
    const existing = await db
      .select({
        workspaceId: materialLibrary.workspaceId,
        ownerType: materialLibrary.ownerType,
        type: materialLibrary.type,
      })
      .from(materialLibrary)
      .where(eq(materialLibrary.id, id))
      .limit(1);

    if (!existing[0]) {
      return NextResponse.json({ error: '素材不存在' }, { status: 404 });
    }

    // 系统素材不允许普通用户修改
    if (existing[0].ownerType === 'system') {
      return NextResponse.json({ error: '系统素材不可修改' }, { status: 403 });
    }

    // 非系统素材仅同 workspace 可修改
    if (existing[0].workspaceId !== workspaceId) {
      return NextResponse.json({ error: '无权修改此素材' }, { status: 403 });
    }

    // 2. 构建素材更新字段
    const productTags = body.productTags !== undefined
      ? (Array.isArray(body.productTags) ? body.productTags : [])
      : undefined;
    const emotionTags = body.emotionTags !== undefined
      ? (Array.isArray(body.emotionTags) ? body.emotionTags : [])
      : undefined;
    const crowdTags = body.crowdTags !== undefined
      ? (Array.isArray(body.crowdTags) ? body.crowdTags : [])
      : undefined;

    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    // 标题更新
    if (body.title !== undefined) updateFields.title = body.title.trim();

    // 内容更新：区分7维素材和结构化案例
    const currentType = existing[0].type || body.type || 'case';
    if (is7DMaterialType(currentType)) {
      // 7维素材：content 是纯文本，直接更新
      if (body.eventFullStory !== undefined) {
        updateFields.content = body.eventFullStory.trim();
      } else if (body.content !== undefined) {
        updateFields.content = body.content.trim();
      }
    } else {
      // 旧格式结构化案例：从结构化字段重建 content
      const contentParts = [
        body.eventFullStory?.trim() ? `【事件经过】\n${body.eventFullStory.trim()}` : '',
        body.background?.trim() ? `【核心背景】\n${body.background.trim()}` : '',
        body.insuranceAction?.trim() ? `【保险动作】\n${body.insuranceAction.trim()}` : '',
        body.result?.trim() ? `【最终结果】\n${body.result.trim()}` : '',
        body.protagonist?.trim() ? `【当事人】\n${body.protagonist.trim()}` : '',
      ].filter(Boolean).join('\n\n');

      if (contentParts) updateFields.content = contentParts;
    }

    // 通用字段
    if (body.result !== undefined) updateFields.analysisText = body.result?.trim() || '';
    if (productTags !== undefined) updateFields.topicTags = productTags;
    if (crowdTags !== undefined) updateFields.sceneTags = crowdTags;
    if (emotionTags !== undefined) updateFields.emotionTags = emotionTags;

    if (Object.keys(updateFields).length <= 1) {
      return NextResponse.json({ error: '没有需要更新的字段' }, { status: 400 });
    }

    // 3. 执行更新
    await db
      .update(materialLibrary)
      .set(updateFields)
      .where(eq(materialLibrary.id, id));

    // 4. 返回更新后的素材
    const updated = await db
      .select()
      .from(materialLibrary)
      .where(eq(materialLibrary.id, id))
      .limit(1);

    return NextResponse.json({ success: true, data: formatMaterialAsItem(updated[0]) });
  } catch (error) {
    console.error('[cases/[id] PUT] 更新失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新失败' },
      { status: 500 }
    );
  }
}
