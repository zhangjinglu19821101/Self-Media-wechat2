/**
 * JSON 解析测试 API
 * 用于测试 JsonParserEnhancer 的各种格式解析能力
 */

import { NextRequest, NextResponse } from 'next/server';
import { JsonParserEnhancer } from '@/lib/utils/json-parser-enhancer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { input } = body;

    if (!input) {
      return NextResponse.json(
        { error: '缺少 input 参数' },
        { status: 400 }
      );
    }

    const result = JsonParserEnhancer.parseSplitResult(input);

    return NextResponse.json({
      success: result.success,
      data: result.data,
      error: result.error,
      warnings: result.warnings,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: '解析失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
