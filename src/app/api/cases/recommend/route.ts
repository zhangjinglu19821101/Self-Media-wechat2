/**
 * 案例检索 API
 * 
 * GET /api/cases/search?productTags=意外险,重疾险&crowdTags=上班族&limit=5
 * POST /api/cases/recommend - 根据指令推荐案例
 * POST /api/cases/recommend - 创建用户自定义案例（需要传递 caseData）
 * 
 * 可见性规则：
 * - 用户私有案例（workspace_id = 用户ID）
 * - 系统预置案例（workspace_id = 'system'）
 */

import { NextRequest, NextResponse } from 'next/server';
import { industryCaseService } from '@/lib/services/industry-case-service';
import { getWorkspaceId } from '@/lib/auth/context';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 🔥 获取 workspaceId 用于可见性过滤
    const workspaceId = await getWorkspaceId(request);
    
    const productTags = searchParams.get('productTags')?.split(',').filter(Boolean);
    const crowdTags = searchParams.get('crowdTags')?.split(',').filter(Boolean);
    const sceneTags = searchParams.get('sceneTags')?.split(',').filter(Boolean);
    const industry = searchParams.get('industry') || 'insurance';
    const caseType = searchParams.get('caseType') || undefined;
    const keywords = searchParams.get('keywords') || undefined;
    const limit = parseInt(searchParams.get('limit') || '5');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const cases = await industryCaseService.searchCases({
      workspaceId,  // 🔥 传递 workspaceId
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

/**
 * POST 方法支持两种模式：
 * 1. 推荐案例：传递 instruction 参数
 * 2. 创建案例：传递 caseData 参数
 */
export async function POST(request: NextRequest) {
  try {
    // 🔥 获取 workspaceId 用于可见性过滤
    const workspaceId = await getWorkspaceId(request);
    
    const body = await request.json();
    
    // 🔥 模式1：创建用户自定义案例
    if (body.caseData) {
      if (!workspaceId) {
        return NextResponse.json({
          success: false,
          error: '创建案例需要登录',
        }, { status: 401 });
      }
      
      const newCase = await industryCaseService.createCase(body.caseData, workspaceId);
      
      return NextResponse.json({
        success: true,
        data: newCase,
        message: '案例创建成功',
      });
    }
    
    // 模式2：推荐案例
    const { instruction, platform, limit } = body;
    
    if (!instruction) {
      return NextResponse.json({
        success: false,
        error: '缺少 instruction 参数',
      }, { status: 400 });
    }
    
    // 🔥 传递 workspaceId 给 recommendCases（需要修改该方法签名）
    const cases = await industryCaseService.recommendCases(instruction, platform, limit || 5, workspaceId);
    
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
    console.error('[API] 案例操作失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    }, { status: 500 });
  }
}
