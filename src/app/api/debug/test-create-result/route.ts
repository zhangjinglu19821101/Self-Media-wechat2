import { NextRequest, NextResponse } from 'next/server';
import { commandResultService } from '@/lib/services/command-result-service';

/**
 * 简单测试：只测试创建结果
 */
export async function POST(request: NextRequest) {
  try {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const taskId = `test-${timestamp}-${randomId}`;

    console.log('🧪 测试创建结果:', taskId);

    const result = await commandResultService.createResult({
      taskId,
      commandId: `cmd-${taskId}`,
      fromAgentId: 'A',
      toAgentId: 'insurance-d',
      originalCommand: `测试指令 ${timestamp}`,
      executionStatus: 'in_progress',
      executionResult: '',
      outputData: {},
    });

    console.log('✅ 创建结果成功:', result.resultId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('❌ 创建结果失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
