/**
 * 小红书范式适配 API
 * 
 * POST /api/paradigm-library/xhs-adapt
 * 输入公众号定稿文章 + 范式ID → 输出小红书版适配内容
 */
import { NextRequest, NextResponse } from 'next/server';
import { adaptToXiaohongshu } from '@/lib/services/paradigm-creation-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { officialArticle, paradigmCode, filledParagraphs } = body;

    if (!officialArticle || !paradigmCode) {
      return NextResponse.json(
        { error: '缺少必要参数：officialArticle, paradigmCode' },
        { status: 400 }
      );
    }

    const result = await adaptToXiaohongshu({
      officialArticle,
      paradigmCode,
      filledParagraphs,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[xhs-adapt] 失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '适配失败' },
      { status: 500 }
    );
  }
}
