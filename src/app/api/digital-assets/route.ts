/**
 * 数字资产 CRUD API
 *
 * GET    /api/digital-assets          — 获取资产列表（支持筛选、分页）
 * POST   /api/digital-assets          — 创建新资产（目前仅支持 style_assets）
 */

import { NextRequest, NextResponse } from 'next/server';
import { digitalAssetService } from '@/lib/services/digital-asset-service';
import type { StyleRuleType, RuleCategory } from '@/lib/db/schema/digital-assets';
import { getWorkspaceId } from '@/lib/auth/context';

export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'style' | 'anchor' | 'feedback' | null;
    const ruleType = searchParams.get('ruleType') as StyleRuleType | null;
    const ruleCategory = searchParams.get('ruleCategory') as RuleCategory | null;
    const isActive = searchParams.get('isActive');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    // 根据类型分发查询
    if (type === 'style' || !type) {
      // 风格规则列表
      const result = await digitalAssetService.listStyleRules({
        workspaceId,
        ruleType: ruleType ?? undefined,
        ruleCategory: ruleCategory as RuleCategory | undefined,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        page,
        pageSize,
      });

      return NextResponse.json({
        success: true,
        data: result.items,
        total: result.total,
        page,
        pageSize,
      });
    }

    return NextResponse.json({
      success: false,
      error: `不支持的资产类型: ${type}`,
    }, { status: 400 });
  } catch (error) {
    console.error('[DigitalAssets API] GET 失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '查询失败',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const body = await request.json();
    const { type, ...data } = body;

    if (!type) {
      return NextResponse.json(
        { success: false, error: '缺少 type 参数（style/anchor/feedback）' },
        { status: 400 }
      );
    }

    if (type === 'style') {
      // 创建风格规则
      const requiredFields = ['ruleType', 'ruleContent', 'ruleCategory'];
      for (const field of requiredFields) {
        if (!data[field]) {
          return NextResponse.json(
            { success: false, error: `缺少必要字段: ${field}` },
            { status: 400 }
          );
        }
      }

      const result = await digitalAssetService.createStyleRule({
        ruleType: data.ruleType,
        ruleContent: data.ruleContent,
        ruleCategory: data.ruleCategory,
        sampleExtract: data.sampleExtract,
        confidence: data.confidence,
        priority: data.priority,
        workspaceId,
      });

      return NextResponse.json({
        success: true,
        data: result,
        message: '风格规则创建成功',
      });
    }

    return NextResponse.json(
      { success: false, error: `不支持的创建类型: ${type}` },
      { status: 400 }
    );
  } catch (error) {
    console.error('[DigitalAssets API] POST 失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '创建失败',
    }, { status: 500 });
  }
}
