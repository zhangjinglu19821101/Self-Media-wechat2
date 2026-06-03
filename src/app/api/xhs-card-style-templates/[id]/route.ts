/**
 * 单个卡片样式模板 CRUD API
 *
 * GET: 获取模板详情
 * PUT: 更新模板（仅用户自定义模板可编辑）
 * DELETE: 删除模板（仅用户自定义模板可删除）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { xhsCardStyleTemplates } from '@/lib/db/schema/xhs-card-style-templates';
import { eq, or, and } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspaceId = await getWorkspaceId(request);
    const db = getDatabase();

    const [template] = await db
      .select()
      .from(xhsCardStyleTemplates)
      .where(
        and(
          eq(xhsCardStyleTemplates.id, id),
          eq(xhsCardStyleTemplates.isActive, true),
          // 系统模板所有人可见，用户模板仅工作区可见
          or(
            eq(xhsCardStyleTemplates.templateType, 'system'),
            eq(xhsCardStyleTemplates.workspaceId, workspaceId)
          )
        )
      );

    if (!template) {
      return NextResponse.json({ success: false, error: '模板不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: template });
  } catch (error: unknown) {
    console.error('获取卡片样式模板详情失败:', error);
    return NextResponse.json({ success: false, error: (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();
    const { name, description, templateConfig, isActive } = body;

    const db = getDatabase();

    // 先检查模板存在且属于当前用户
    const [existing] = await db
      .select()
      .from(xhsCardStyleTemplates)
      .where(
        and(
          eq(xhsCardStyleTemplates.id, id),
          eq(xhsCardStyleTemplates.workspaceId, workspaceId),
          eq(xhsCardStyleTemplates.templateType, 'user')
        )
      );

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '模板不存在或无权编辑' },
        { status: 404 }
      );
    }

    // 构建更新对象
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (templateConfig !== undefined) updateData.templateConfig = templateConfig;
    if (isActive !== undefined) updateData.isActive = isActive;

    const [updated] = await db
      .update(xhsCardStyleTemplates)
      .set(updateData)
      .where(eq(xhsCardStyleTemplates.id, id))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    console.error('更新卡片样式模板失败:', error);
    return NextResponse.json({ success: false, error: (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspaceId = await getWorkspaceId(request);
    const db = getDatabase();

    // 检查模板存在且属于当前用户
    const [existing] = await db
      .select()
      .from(xhsCardStyleTemplates)
      .where(
        and(
          eq(xhsCardStyleTemplates.id, id),
          eq(xhsCardStyleTemplates.workspaceId, workspaceId),
          eq(xhsCardStyleTemplates.templateType, 'user')
        )
      );

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '模板不存在或无权删除' },
        { status: 404 }
      );
    }

    // 软删除
    await db
      .update(xhsCardStyleTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(xhsCardStyleTemplates.id, id));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('删除卡片样式模板失败:', error);
    return NextResponse.json({ success: false, error: (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}
