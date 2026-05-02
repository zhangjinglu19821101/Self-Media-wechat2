import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { industryCaseLibrary, CASE_SYSTEM_WORKSPACE_ID } from '@/lib/db/schema/industry-case-library';
import { getWorkspaceId } from '@/lib/auth/context';
import { and, eq, or } from 'drizzle-orm';

/**
 * GET /api/cases/[id]
 * 根据 ID 获取案例详情
 * 
 * 可见性规则：
 * - workspaceId = 'system' 的案例 → 所有用户可访问（系统预置/管理员共享）
 * - workspaceId = 其他 → 仅同 workspace 用户可访问
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
      .from(industryCaseLibrary)
      .where(
        and(
          eq(industryCaseLibrary.id, id),
          or(
            eq(industryCaseLibrary.workspaceId, CASE_SYSTEM_WORKSPACE_ID),
            eq(industryCaseLibrary.workspaceId, workspaceId)
          )
        )
      )
      .limit(1);

    if (!result[0]) {
      return NextResponse.json({ error: '案例不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result[0] });
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
 * 更新案例内容
 *
 * 权限规则：
 * - workspaceId = 'system' 的案例 → 仅管理员可修改
 * - workspaceId = 其他 → 仅同 workspace 用户可修改
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();

    // 1. 查询案例，校验权限
    const existing = await db
      .select({ workspaceId: industryCaseLibrary.workspaceId })
      .from(industryCaseLibrary)
      .where(eq(industryCaseLibrary.id, id))
      .limit(1);

    if (!existing[0]) {
      return NextResponse.json({ error: '案例不存在' }, { status: 404 });
    }

    // 系统预置案例不允许普通用户修改
    if (existing[0].workspaceId === CASE_SYSTEM_WORKSPACE_ID) {
      return NextResponse.json({ error: '系统预置案例不可修改' }, { status: 403 });
    }

    // 非 system 案例仅同 workspace 可修改
    if (existing[0].workspaceId !== workspaceId) {
      return NextResponse.json({ error: '无权修改此案例' }, { status: 403 });
    }

    // 2. 构造更新字段（仅允许更新业务字段，不更新 id/workspaceId/caseId 等）
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    const allowedFields = [
      'title', 'eventFullStory', 'background', 'insuranceAction', 'result',
      'protagonist', 'productTags', 'crowdTags', 'sceneTags', 'emotionTags',
      'applicableProducts', 'applicableScenarios', 'sourceDesc', 'sourceUrl',
      'complianceNote', 'status',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields[field] = body[field];
      }
    }

    if (Object.keys(updateFields).length <= 1) {
      return NextResponse.json({ error: '没有需要更新的字段' }, { status: 400 });
    }

    // 3. 执行更新
    await db
      .update(industryCaseLibrary)
      .set(updateFields)
      .where(eq(industryCaseLibrary.id, id));

    // 4. 返回更新后的案例
    const updated = await db
      .select()
      .from(industryCaseLibrary)
      .where(eq(industryCaseLibrary.id, id))
      .limit(1);

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('[cases/[id] PUT] 更新失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新失败' },
      { status: 500 }
    );
  }
}
