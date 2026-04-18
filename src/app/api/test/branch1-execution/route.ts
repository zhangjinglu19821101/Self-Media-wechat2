import { NextRequest, NextResponse } from 'next/server';
import { executeBranch1 } from '@/lib/mcp/branch1-executor';
import { db } from '@/lib/db';
import { capabilityList } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';

/**
 * 辅助函数：根据ID列表获取能力列表
 */
async function getCapabilityListByIds(ids: number[]) {
  if (ids.length === 0) return [];
  
  const results = await db
    .select()
    .from(capabilityList)
    .where(inArray(capabilityList.id, ids));
  
  return results;
}

/**
 * 分支1执行测试API
 * 测试根据 solution_num 执行对应 capability 的功能
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, solutionNum, agentParams, agentBOutput } = body;

    console.log('[分支1测试API] 收到请求:', {
      taskId,
      solutionNum,
      agentParams,
      hasAgentBOutput: !!agentBOutput
    });

    // 1. 验证参数
    if (!taskId || !solutionNum) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数: taskId 和 solutionNum'
      }, { status: 400 });
    }

    // 2. 先查询能力信息供调试
    const capabilityInfo = await getCapabilityListByIds([solutionNum]);
    const capability = capabilityInfo[0];

    if (!capability) {
      return NextResponse.json({
        success: false,
        error: `未找到ID为 ${solutionNum} 的能力`
      }, { status: 404 });
    }

    console.log('[分支1测试API] 能力信息:', {
      id: capability.id,
      toolName: capability.toolName,
      actionName: capability.actionName,
      requiresOnSiteExecution: capability.requiresOnSiteExecution,
      hasInterfaceSchema: !!capability.interfaceSchema,
      hasParamExamples: !!capability.paramExamples
    });

    // 3. 执行分支1逻辑
    const result = await executeBranch1(taskId, solutionNum, agentParams, agentBOutput);

    console.log('[分支1测试API] 执行结果:', {
      success: result.success,
      executionMode: result.executionMode,
      resultLength: result.result ? JSON.stringify(result.result).length : 0
    });

    return NextResponse.json({
      success: true,
      data: {
        capability: {
          id: capability.id,
          capabilityType: capability.capabilityType,
          functionDesc: capability.functionDesc,
          toolName: capability.toolName,
          actionName: capability.actionName,
          requiresOnSiteExecution: capability.requiresOnSiteExecution,
          interfaceSchema: capability.interfaceSchema,
          paramExamples: capability.paramExamples
        },
        executionResult: result
      }
    });

  } catch (error) {
    console.error('[分支1测试API] 执行失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '执行失败'
    }, { status: 500 });
  }
}

/**
 * 获取能力详情（用于调试）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const capabilityId = searchParams.get('id');

    if (!capabilityId) {
      // 返回所有带接口信息的能力列表
      const allCapabilities = await getCapabilityListByIds([
        11, 12, 13, 14, 15, 16, 17, 18, 19
      ]);

      return NextResponse.json({
        success: true,
        data: allCapabilities.map(cap => ({
          id: cap.id,
          capabilityType: cap.capabilityType,
          functionDesc: cap.functionDesc,
          toolName: cap.toolName,
          actionName: cap.actionName,
          requiresOnSiteExecution: cap.requiresOnSiteExecution,
          hasInterfaceSchema: !!cap.interfaceSchema,
          hasParamExamples: !!cap.paramExamples
        }))
      });
    }

    // 获取单个能力详情
    const capabilities = await getCapabilityListByIds([parseInt(capabilityId)]);
    const capability = capabilities[0];

    if (!capability) {
      return NextResponse.json({
        success: false,
        error: '能力不存在'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: capability
    });

  } catch (error) {
    console.error('[分支1测试API] 查询失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '查询失败'
    }, { status: 500 });
  }
}
