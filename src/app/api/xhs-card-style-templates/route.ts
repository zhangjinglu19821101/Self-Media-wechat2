/**
 * 小红书卡片样式模板 API
 *
 * GET: 获取模板列表（预设+用户自定义）
 * POST: 创建用户自定义模板
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { xhsCardStyleTemplates } from '@/lib/db/schema/xhs-card-style-templates';
import { eq, or, and, desc, asc } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';

export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const db = getDatabase();

    // 查询：系统预设模板（所有人可见）+ 用户自定义模板（仅当前工作区）
    const templates = await db
      .select()
      .from(xhsCardStyleTemplates)
      .where(
        and(
          eq(xhsCardStyleTemplates.isActive, true),
          or(
            eq(xhsCardStyleTemplates.templateType, 'system'),
            eq(xhsCardStyleTemplates.workspaceId, workspaceId)
          )
        )
      )
      .orderBy(asc(xhsCardStyleTemplates.sortOrder), desc(xhsCardStyleTemplates.createdAt));

    return NextResponse.json({ success: true, data: templates });
  } catch (error: any) {
    console.error('获取卡片样式模板列表失败:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();
    const { name, description, templateConfig, sourceType } = body;

    if (!name || !templateConfig) {
      return NextResponse.json(
        { success: false, error: '缺少必要字段：name, templateConfig' },
        { status: 400 }
      );
    }

    // 验证 templateConfig 基本结构
    if (!templateConfig.id || !templateConfig.cover || !templateConfig.point || !templateConfig.conclusion) {
      return NextResponse.json(
        { success: false, error: 'templateConfig 结构不完整，必须包含 id/cover/point/conclusion' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const [created] = await db
      .insert(xhsCardStyleTemplates)
      .values({
        workspaceId,
        name,
        description: description || '',
        templateType: 'user',
        templateConfig,
        sourceType: sourceType || 'manual',
        sortOrder: 100, // 用户模板排在预设之后
        isActive: true,
      })
      .returning();

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    console.error('创建卡片样式模板失败:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
