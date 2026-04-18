/**
 * 单个风格模板 API
 * GET: 获取模板详情
 * PUT: 更新模板
 * DELETE: 删除模板
 */

import { NextRequest, NextResponse } from 'next/server';
import { styleTemplateService } from '@/lib/services/style-template-service';
import { getWorkspaceId } from '@/lib/auth/context';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const workspaceId = await getWorkspaceId(request);
    
    const template = await styleTemplateService.getTemplate(params.id, workspaceId);
    
    if (!template) {
      return NextResponse.json({
        success: false,
        error: '模板不存在',
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    console.error('[API] 获取模板详情失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '获取失败',
    }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();
    const { name, description, isDefault, isActive } = body;
    
    const template = await styleTemplateService.updateTemplate(params.id, workspaceId, {
      name,
      description,
      isDefault,
      isActive,
    });
    
    if (!template) {
      return NextResponse.json({
        success: false,
        error: '模板不存在或无权访问',
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    console.error('[API] 更新模板失败:', error);
    
    if (error.message?.includes('不能') || error.message?.includes('超过')) {
      return NextResponse.json({
        success: false,
        error: error.message,
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: false,
      error: error.message || '更新失败',
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const workspaceId = await getWorkspaceId(request);
    
    const result = await styleTemplateService.deleteTemplate(params.id, workspaceId);
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.message,
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    console.error('[API] 删除模板失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '删除失败',
    }, { status: 500 });
  }
}
