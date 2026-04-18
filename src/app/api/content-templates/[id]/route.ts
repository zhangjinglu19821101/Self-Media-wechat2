import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { contentTemplateService } from '@/lib/services/content-template-service';

/**
 * 获取单个内容模板详情
 * GET /api/content-templates/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { workspaceId } = authResult;

    const { id } = await params;
    const template = await contentTemplateService.getTemplate(id, workspaceId);

    if (!template) {
      return NextResponse.json(
        { success: false, error: '模板不存在或无权限' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('[ContentTemplateAPI] GET [id] error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * 更新内容模板
 * PUT /api/content-templates/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { workspaceId } = authResult;

    const { id } = await params;
    const body = await request.json();
    const { name, description, isActive } = body;

    const template = await contentTemplateService.updateTemplate(id, workspaceId, {
      name,
      description,
      isActive,
    });

    if (!template) {
      return NextResponse.json(
        { success: false, error: '模板不存在或无权限' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('[ContentTemplateAPI] PUT [id] error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * 删除内容模板（软删除）
 * DELETE /api/content-templates/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { workspaceId } = authResult;

    const { id } = await params;
    const result = await contentTemplateService.deleteTemplate(id, workspaceId);

    if (!result) {
      return NextResponse.json(
        { success: false, error: '模板不存在或无权限' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ContentTemplateAPI] DELETE [id] error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
