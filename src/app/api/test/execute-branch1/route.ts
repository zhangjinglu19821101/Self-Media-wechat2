/**
 * 测试 API：执行分支1（用于测试合规校验功能）
 * POST /api/test/execute-branch1
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeBranch1 } from '@/lib/mcp/branch1-executor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('[API Test] 收到 executeBranch1 测试请求:', body);
    
    const { solutionNum, agentBOutput, mcpArgs } = body;
    
    if (!solutionNum || !agentBOutput) {
      return NextResponse.json({
        success: false,
        error: '缺少必需参数: solutionNum, agentBOutput'
      }, { status: 400 });
    }
    
    // 调用 branch1-executor
    const result = await executeBranch1({
      solutionNum,
      agentBOutput,
      mcpArgs
    });
    
    console.log('[API Test] executeBranch1 执行结果:', result);
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API Test] executeBranch1 执行失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message || '执行失败'
    }, { status: 500 });
  }
}
