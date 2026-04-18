/**
 * 风格模板 API
 * GET: 获取工作空间所有风格模板（支持按平台筛选）
 * POST: 创建新风格模板
 */

import { NextRequest, NextResponse } from 'next/server';
import { styleTemplateService } from '@/lib/services/style-template-service';
import { PlatformType, isValidPlatform, getValidPlatform } from '@/lib/db/schema/style-template';
import { getWorkspaceId } from '@/lib/auth/context';

/**
 * GET /api/style-templates
 * 获取工作空间所有风格模板
 * Query params:
 * - platform: 按平台筛选 (wechat_official | xiaohongshu | zhihu | douyin | weibo)
 */
export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { searchParams } = new URL(request.url);
    const platformParam = searchParams.get('platform');
    
    const platform = platformParam && isValidPlatform(platformParam) 
      ? platformParam 
      : undefined;
    
    const templates = await styleTemplateService.listTemplates(workspaceId, platform);
    
    return NextResponse.json({
      success: true,
      data: templates,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '获取失败';
    console.error('[API] 获取风格模板失败:', error);
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}

/**
 * POST /api/style-templates
 * 创建新风格模板
 */
export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();
    const { name, description, platform: platformParam, isDefault } = body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: '模板名称不能为空',
      }, { status: 400 });
    }
    
    const platform = getValidPlatform(platformParam);
    
    const template = await styleTemplateService.createTemplate(workspaceId, {
      name: name.trim(),
      description,
      platform,
      isDefault: isDefault || false,
    });
    
    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '创建失败';
    console.error('[API] 创建风格模板失败:', error);
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}
