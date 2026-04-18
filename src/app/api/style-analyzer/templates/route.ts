/**
 * 风格模板分类 API
 * GET /api/style-analyzer/templates
 * GET /api/style-analyzer/category/:category
 * GET /api/style-analyzer/latest
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { styleLearner } from '@/lib/style-analyzer';

/**
 * 获取所有模板或按分类筛选
 */
export async function GET(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const latest = searchParams.get('latest');

    // 获取最新模板
    if (latest === 'true') {
      const template = styleLearner.getLatestTemplate(category || undefined);

      if (!template) {
        return NextResponse.json(
          {
            success: false,
            error: '未找到模板',
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: template,
      });
    }

    // 按分类获取模板
    if (category) {
      const templates = styleLearner.getTemplatesByCategory(category);

      return NextResponse.json({
        success: true,
        data: {
          templates,
          total: templates.length,
          category,
        },
      });
    }

    // 获取所有模板
    const templates = styleLearner.getAllTemplates();

    return NextResponse.json({
      success: true,
      data: {
        templates,
        total: templates.length,
      },
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
