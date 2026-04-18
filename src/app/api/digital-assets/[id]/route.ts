/**
 * 单个数字资产 CRUD API
 *
 * GET    /api/digital-assets/[id]  — 获取资产详情
 * PUT    /api/digital-assets/[id]  — 更新资产
 * DELETE /api/digital-assets/[id]  — 删除资产（软删除）
 */

import { NextRequest, NextResponse } from 'next/server';
import { digitalAssetService } from '@/lib/services/digital-asset-service';
import { getWorkspaceId } from '@/lib/auth/context';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspaceId = await getWorkspaceId(request);

    // 通过 listStyleRules 获取单条记录（含 workspace 隔离）
    const result = await digitalAssetService.listStyleRules({ workspaceId, pageSize: 1000 });
    const item = result.items.find((item) => item.id === id);

    if (!item) {
      return NextResponse.json(
        { success: false, error: '未找到该资产' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: item,
    });
  } catch (error) {
    console.error('[DigitalAssets ID API] GET 失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const result = await digitalAssetService.updateStyleRule(id, {
      ruleType: body.ruleType,
      ruleContent: body.ruleContent,
      ruleCategory: body.ruleCategory,
      sampleExtract: body.sampleExtract,
      confidence: body.confidence,
      priority: body.priority,
      isActive: body.isActive,
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: '未找到该资产或更新失败' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: '资产更新成功',
    });
  } catch (error) {
    console.error('[DigitalAssets ID API] PUT 失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '更新失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const workspaceId = await getWorkspaceId(request);

    // 验证资产属于当前 workspace
    const result = await digitalAssetService.listStyleRules({ workspaceId, pageSize: 1000 });
    const item = result.items.find((item) => item.id === id);

    if (!item) {
      return NextResponse.json(
        { success: false, error: '未找到该资产' },
        { status: 404 }
      );
    }

    const success = await digitalAssetService.deleteStyleRule(id);

    if (!success) {
      return NextResponse.json(
        { success: false, error: '删除失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '资产已软删除（设为不活跃）',
    });
  } catch (error) {
    console.error('[DigitalAssets ID API] DELETE 失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '删除失败' },
      { status: 500 }
    );
  }
}
