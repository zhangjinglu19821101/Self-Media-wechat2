/**
 * 风格学习与分析 API
 * POST /api/style-analyzer/learn
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { styleAnalyzer, styleLearner } from '@/lib/style-analyzer';

export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const body = await request.json();
    const { articles, categoryName } = body;

    // 参数验证
    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误：articles 必须是非空数组',
        },
        { status: 400 }
      );
    }

    // 验证每篇文章内容
    for (let i = 0; i < articles.length; i++) {
      if (typeof articles[i] !== 'string' || articles[i].trim().length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: `参数错误：第 ${i + 1} 篇文章内容无效`,
          },
          { status: 400 }
        );
      }
    }

    // 执行风格分析
    const analysisResult = await styleAnalyzer.analyzeStyle({
      articles,
      categoryName: categoryName || '通用',
    });

    // 保存风格模板
    styleLearner.saveTemplate(analysisResult.template);

    return NextResponse.json({
      success: true,
      data: analysisResult,
    });
  } catch (error: any) {
    console.error('风格学习失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '风格学习失败',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
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
