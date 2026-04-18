/**
 * 样式模板详情 API
 * GET: 获取模板详情
 * PUT: 更新模板
 * DELETE: 删除模板（系统模板不可删除）
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { styleTemplates } from '@/lib/template/schema';
import { eq } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/template/[id]
 * 获取模板详情
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { id } = await params;

    const [template] = await db
      .select()
      .from(styleTemplates)
      .where(eq(styleTemplates.id, id))
      .limit(1);

    if (!template) {
      return NextResponse.json(
        { success: false, error: '模板不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('获取模板详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取模板详情失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/template/[id]
 * 更新模板
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { id } = await params;
    const body = await request.json();
    const { name, htmlContent, platform } = body;

    // 检查模板是否存在
    const [existingTemplate] = await db
      .select()
      .from(styleTemplates)
      .where(eq(styleTemplates.id, id))
      .limit(1);

    if (!existingTemplate) {
      return NextResponse.json(
        { success: false, error: '模板不存在' },
        { status: 404 }
      );
    }

    // 构建更新数据
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json(
          { success: false, error: '模板名称不能为空' },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }

    if (htmlContent !== undefined) {
      if (!htmlContent.trim()) {
        return NextResponse.json(
          { success: false, error: 'HTML 样式代码不能为空' },
          { status: 400 }
        );
      }
      updateData.htmlContent = htmlContent.trim();
    }

    if (platform !== undefined) {
      updateData.platform = platform;
    }

    // 更新模板
    const [updatedTemplate] = await db
      .update(styleTemplates)
      .set(updateData)
      .where(eq(styleTemplates.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      data: updatedTemplate,
      message: '模板更新成功',
    });
  } catch (error) {
    console.error('更新模板失败:', error);
    return NextResponse.json(
      { success: false, error: '更新模板失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/template/[id]
 * 删除模板（系统模板不可删除）
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { id } = await params;

    // 检查模板是否存在
    const [existingTemplate] = await db
      .select()
      .from(styleTemplates)
      .where(eq(styleTemplates.id, id))
      .limit(1);

    if (!existingTemplate) {
      return NextResponse.json(
        { success: false, error: '模板不存在' },
        { status: 404 }
      );
    }

    // 检查是否为系统模板
    if (existingTemplate.isSystem) {
      return NextResponse.json(
        { success: false, error: '系统模板不可删除' },
        { status: 403 }
      );
    }

    // 删除模板
    await db.delete(styleTemplates).where(eq(styleTemplates.id, id));

    return NextResponse.json({
      success: true,
      message: '模板删除成功',
    });
  } catch (error) {
    console.error('删除模板失败:', error);
    return NextResponse.json(
      { success: false, error: '删除模板失败' },
      { status: 500 }
    );
  }
}
