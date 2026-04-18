/**
 * 风格模板管理 API
 * GET /api/style-analyzer/templates/:id
 * DELETE /api/style-analyzer/templates/:id
 * PATCH /api/style-analyzer/templates/:id
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { styleLearner } from '@/lib/style-analyzer';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { id } = params;

    const template = styleLearner.getTemplate(id);

    if (!template) {
      return NextResponse.json(
        {
          success: false,
          error: '模板不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    console.error('获取风格模板失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '获取风格模板失败',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { id } = params;

    const deleted = styleLearner.deleteTemplate(id);

    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          error: '模板不存在或删除失败',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '模板删除成功',
    });
  } catch (error: any) {
    console.error('删除风格模板失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '删除风格模板失败',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { id } = params;
    const body = await request.json();

    const updated = styleLearner.updateTemplate(id, body);

    if (!updated) {
      return NextResponse.json(
        {
          success: false,
          error: '模板不存在或更新失败',
        },
        { status: 404 }
      );
    }

    const template = styleLearner.getTemplate(id);

    return NextResponse.json({
      success: true,
      data: template,
      message: '模板更新成功',
    });
  } catch (error: any) {
    console.error('更新风格模板失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '更新风格模板失败',
      },
      { status: 500 }
    );
  }
}
