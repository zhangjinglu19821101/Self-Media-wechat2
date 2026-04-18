/**
 * 账号-模板绑定 API
 * POST: 绑定账号到模板
 * DELETE: 解除绑定
 */

import { NextRequest, NextResponse } from 'next/server';
import { styleTemplateService } from '@/lib/services/style-template-service';
import { getWorkspaceId } from '@/lib/auth/context';

export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();
    const { accountId, templateId, priority } = body;
    
    if (!accountId || !templateId) {
      return NextResponse.json({
        success: false,
        error: '缺少必填参数: accountId, templateId',
      }, { status: 400 });
    }
    
    const config = await styleTemplateService.bindAccountToTemplate(
      workspaceId,
      accountId,
      templateId,
      priority
    );
    
    return NextResponse.json({
      success: true,
      data: config,
      message: '绑定成功',
    });
  } catch (error: any) {
    console.error('[API] 绑定账号到模板失败:', error);
    
    if (error.message?.includes('不存在') || error.message?.includes('无权')) {
      return NextResponse.json({
        success: false,
        error: error.message,
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: false,
      error: error.message || '绑定失败',
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const accountId = request.nextUrl.searchParams.get('accountId');
    
    if (!accountId) {
      return NextResponse.json({
        success: false,
        error: '缺少参数: accountId',
      }, { status: 400 });
    }
    
    const success = await styleTemplateService.unbindAccount(accountId, workspaceId);
    
    return NextResponse.json({
      success,
      message: success ? '解绑成功' : '解绑失败或账号不存在',
    });
  } catch (error: any) {
    console.error('[API] 解除绑定失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '解绑失败',
    }, { status: 500 });
  }
}
