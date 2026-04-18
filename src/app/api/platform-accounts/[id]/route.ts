/**
 * 单个平台账号 API
 * GET: 获取账号详情（含平台配置）
 * PUT: 更新账号信息（含平台专属配置）
 * DELETE: 删除账号
 */

import { NextRequest, NextResponse } from 'next/server';
import { styleTemplateService } from '@/lib/services/style-template-service';
import { getWorkspaceId } from '@/lib/auth/context';
import type { PlatformConfig } from '@/lib/db/schema/style-template';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const workspaceId = await getWorkspaceId(request);

    const account = await styleTemplateService.getAccount(params.id, workspaceId);
    if (!account) {
      return NextResponse.json({
        success: false,
        error: '账号不存在或无权访问',
      }, { status: 404 });
    }

    // 获取平台配置详情
    const platformConfigResult = await styleTemplateService.getPlatformConfig(params.id, workspaceId);

    return NextResponse.json({
      success: true,
      data: {
        account,
        platformConfig: platformConfigResult?.config || {},
      },
    });
  } catch (error: any) {
    console.error('[API] 获取账号详情失败:', error);
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

    // 如果请求体包含 platformConfig，使用专用方法更新
    if (body.platformConfig !== undefined) {
      const updated = await styleTemplateService.updatePlatformConfig(
        params.id,
        workspaceId,
        body.platformConfig as PlatformConfig
      );

      if (!updated) {
        return NextResponse.json({
          success: false,
          error: '账号不存在或无权访问',
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: updated,
      });
    }

    // 通用账号信息更新
    const updated = await styleTemplateService.updateAccount(params.id, workspaceId, body);

    if (!updated) {
      return NextResponse.json({
        success: false,
        error: '账号不存在或无权访问',
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error('[API] 更新账号失败:', error);
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
    
    const result = await styleTemplateService.deleteAccount(params.id, workspaceId);
    
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
    console.error('[API] 删除账号失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '删除失败',
    }, { status: 500 });
  }
}
