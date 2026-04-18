/**
 * 手动触发执行特定子任务（用于测试）
 * POST /api/cron/execute-specific-task
 * 
 * 请求体:
 * {
 *   "commandResultId": "xxx-xxx-xxx",
 *   "orderIndex": 2
 * }
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { commandResultId, orderIndex } = body;

    if (!commandResultId) {
      return NextResponse.json(
        { success: false, error: '缺少 commandResultId 参数' },
        { status: 400 }
      );
    }

    console.log('🔔 手动触发执行特定子任务...');
    console.log('🔔 参数:', { commandResultId, orderIndex });

    // 导入并实例化子任务执行引擎
    const { SubtaskExecutionEngine } = await import('@/lib/services/subtask-execution-engine');
    const engine = new SubtaskExecutionEngine();

    // 执行特定任务
    const result = await engine.executeSpecificTask(commandResultId, orderIndex);

    console.log('✅ 特定子任务执行完成:', result);

    return NextResponse.json({
      success: true,
      message: '特定子任务执行完成',
      result,
    });
  } catch (error) {
    console.error('❌ 执行特定子任务失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '执行失败',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/execute-specific-task
 * 获取接口信息
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    name: 'execute-specific-task',
    description: '手动触发执行特定子任务（用于测试）',
    usage: {
      method: 'POST',
      endpoint: '/api/cron/execute-specific-task',
      body: {
        commandResultId: '指令结果 ID（必填）',
        orderIndex: '顺序索引（可选，不指定则执行该 command_result_id 下所有任务）',
      },
      example: {
        commandResultId: '943242-2347-2682-33b95285-210859256',
        orderIndex: 2,
      },
    },
  });
}
