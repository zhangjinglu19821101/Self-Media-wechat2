import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { materialLibrary } from '@/lib/db/schema/material-library';
import { getWorkspaceId } from '@/lib/auth/context';
import { and, eq, or } from 'drizzle-orm';

/**
 * 从 material_library 的 case 类型素材格式化为前端 CaseItem 格式
 */
function formatMaterialAsCase(m: any) {
  // 从 content 中解析结构化段落
  const content = m.content || '';
  const sections: Record<string, string> = {};
  const sectionRegex = /【(.+?)】\n([\s\S]*?)(?=\n【|$)/g;
  let match;
  while ((match = sectionRegex.exec(content)) !== null) {
    sections[match[1]] = match[2].trim();
  }

  return {
    id: m.id,
    caseId: m.id, // 兼容前端
    caseType: m.emotionTags?.includes('警示') ? 'warning' : 'positive',
    title: m.title || '',
    eventFullStory: sections['事件经过'] || content,
    background: sections['核心背景'] || '',
    insuranceAction: sections['保险动作'] || '',
    result: sections['结果'] || m.analysisText || '',
    protagonist: sections['主人公'] || '',
    productTags: m.topicTags || [],
    crowdTags: m.sceneTags || [],
    sceneTags: m.sceneTags || [],
    emotionTags: m.emotionTags || [],
    applicableProducts: m.topicTags || [],
    applicableScenarios: m.sceneTags || [],
    industry: 'insurance',
    workspaceId: m.workspaceId,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

/**
 * GET /api/cases/[id]
 * 根据 ID 获取案例素材详情（从 material_library 查询）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspaceId = await getWorkspaceId(request);

    const result = await db
      .select()
      .from(materialLibrary)
      .where(
        and(
          eq(materialLibrary.id, id),
          eq(materialLibrary.type, 'case'),
          or(
            eq(materialLibrary.ownerType, 'system'),
            eq(materialLibrary.workspaceId, workspaceId || '')
          )
        )
      )
      .limit(1);

    if (!result[0]) {
      return NextResponse.json({ error: '案例素材不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: formatMaterialAsCase(result[0]) });
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
 * 更新案例素材内容（更新 material_library）
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
      .select({ workspaceId: materialLibrary.workspaceId, ownerType: materialLibrary.ownerType })
      .from(materialLibrary)
      .where(eq(materialLibrary.id, id))
      .limit(1);

    if (!existing[0]) {
      return NextResponse.json({ error: '案例素材不存在' }, { status: 404 });
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

    // 重建 content（从案例结构化字段）
    const contentParts = [
      body.eventFullStory?.trim() ? `【事件经过】\n${body.eventFullStory.trim()}` : '',
      body.background?.trim() ? `【核心背景】\n${body.background.trim()}` : '',
      body.insuranceAction?.trim() ? `【保险动作】\n${body.insuranceAction.trim()}` : '',
      body.result?.trim() ? `【结果】\n${body.result.trim()}` : '',
      body.protagonist?.trim() ? `【主人公】\n${body.protagonist.trim()}` : '',
    ].filter(Boolean).join('\n\n');

    const updateFields: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) updateFields.title = body.title.trim();
    if (contentParts) updateFields.content = contentParts;
    if (body.result !== undefined) updateFields.analysisText = body.result.trim();
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

    return NextResponse.json({ success: true, data: formatMaterialAsCase(updated[0]) });
  } catch (error) {
    console.error('[cases/[id] PUT] 更新失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新失败' },
      { status: 500 }
    );
  }
}
