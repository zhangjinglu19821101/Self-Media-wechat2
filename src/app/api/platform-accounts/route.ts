/**
 * 平台账号 API
 * GET: 获取工作空间所有平台账号（含绑定的模板信息）
 * POST: 创建新平台账号
 */

import { NextRequest, NextResponse } from 'next/server';
import { styleTemplateService } from '@/lib/services/style-template-service';
import { getWorkspaceId } from '@/lib/auth/context';
import type { PlatformConfig } from '@/lib/db/schema/style-template';

export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const accountConfigs = await styleTemplateService.listAccountConfigs(workspaceId);
    
    return NextResponse.json({
      success: true,
      data: accountConfigs,
    });
  } catch (error: any) {
    console.error('[API] 获取平台账号失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '获取失败',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();
    const { platform, accountName, accountId, accountDescription, templateId, platformConfig } = body;
    
    const account = await styleTemplateService.createAccount(workspaceId, {
      platform,
      accountName,
      accountId,
      accountDescription,
      platformConfig: platformConfig as PlatformConfig | undefined,
    });
    
    if (templateId) {
      await styleTemplateService.bindAccountToTemplate(workspaceId, account.id, templateId);
    }
    
    return NextResponse.json({
      success: true,
      data: account,
    });
  } catch (error: any) {
    console.error('[API] 创建平台账号失败:', error);
    
    if (error.message?.includes('不能') || error.message?.includes('请')) {
      return NextResponse.json({
        success: false,
        error: error.message,
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: false,
      error: error.message || '创建失败',
    }, { status: 500 });
  }
}
