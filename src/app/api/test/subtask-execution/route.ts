/**
 * 测试接口：执行特定的子任务
 * POST /api/test/subtask-execution
 * 用于测试 Agent T 执行和 Agent B 评审的完整流程
 */

import { NextRequest, NextResponse } from 'next/server';
import { SubtaskExecutionEngine } from '@/lib/services/subtask-execution-engine';

/**
 * POST /api/test/subtask-execution
 * 执行特定的 command_result_id 和 order_index
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { commandResultId, orderIndex } = body;

    if (!commandResultId) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必填参数: commandResultId',
        },
        { status: 400 }
      );
    }

    console.log('🔔 [测试接口] 开始执行特定子任务...');
    console.log('🔔 [测试接口] 参数:', {
      commandResultId,
      orderIndex,
    });

    // 1. 实例化子任务执行引擎
    const engine = new SubtaskExecutionEngine();
    
    // 2. 执行特定任务
    const result = await engine.executeSpecificTask(commandResultId, orderIndex);
    
    console.log('✅ [测试接口] 特定子任务执行完成');

    return NextResponse.json({
      success: true,
      message: '特定子任务执行完成',
      data: result,
    });
  } catch (error) {
    console.error('❌ [测试接口] 执行特定子任务失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '执行失败',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/test/subtask-execution
 * 获取测试接口信息
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    name: 'test-subtask-execution',
    description: '测试执行特定的子任务（Agent T 执行 + Agent B 评审）',
    usage: {
      method: 'POST',
      endpoint: '/api/test/subtask-execution',
      body: {
        commandResultId: 'string (必填) - 指令结果 ID',
        orderIndex: 'number (可选) - 顺序索引，不指定则执行该 commandResultId 下所有任务',
      },
      example: {
        commandResultId: 'e70ee6e8-8391-4b11-9f31-5e69f24a38e5',
        orderIndex: 2,
      },
    },
  });
}
