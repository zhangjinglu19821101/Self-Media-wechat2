/**
 * 案例检索 API
 * 
 * GET /api/cases/search?productTags=意外险,重疾险&crowdTags=上班族&limit=5
 * POST /api/cases/recommend - 根据指令推荐案例
 */

import { NextRequest, NextResponse } from 'next/server';
import { industryCaseService } from '@/lib/services/industry-case-service';
import { getWorkspaceId } from '@/lib/auth/context';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const productTags = searchParams.get('productTags')?.split(',').filter(Boolean);
    const crowdTags = searchParams.get('crowdTags')?.split(',').filter(Boolean);
    const sceneTags = searchParams.get('sceneTags')?.split(',').filter(Boolean);
    const industry = searchParams.get('industry') || 'insurance';
    const caseType = searchParams.get('caseType') || undefined;
    const keywords = searchParams.get('keywords') || undefined;
    const limit = parseInt(searchParams.get('limit') || '5');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const cases = await industryCaseService.searchCases({
      industry,
      caseType,
      productTags,
      crowdTags,
      sceneTags,
      keywords,
      limit,
      offset,
    });
    
    return NextResponse.json({
      success: true,
      data: cases,
      total: cases.length,
    });
  } catch (error) {
    console.error('[API] 案例检索失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { instruction, platform, limit } = body;
    
    if (!instruction) {
      return NextResponse.json({
        success: false,
        error: '缺少 instruction 参数',
      }, { status: 400 });
    }
    
    const cases = await industryCaseService.recommendCases(instruction, platform, limit || 5);
    
    // 格式化为提示词文本
    const promptText = industryCaseService.formatCasesForPrompt(cases);
    
    return NextResponse.json({
      success: true,
      data: {
        cases,
        promptText,
      },
    });
  } catch (error) {
    console.error('[API] 案例推荐失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    }, { status: 500 });
  }
}
