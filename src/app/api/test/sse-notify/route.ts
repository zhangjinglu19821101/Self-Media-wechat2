/**
 * POST /api/test/sse-notify
 * 测试 SSE 通知推送
 *
 * 用于测试 SSE 推送功能是否正常工作
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendNotificationToAgent } from '@/app/api/agents/sse-manager';

export async function POST(request: NextRequest) {
  console.log('🧪 === 测试 SSE 通知推送 ===');

  try {
    const body = await request.json();
    const {
      agentId = 'A',
      type = 'task_result',
      fromAgentId = 'D',
      taskId = 'test-task-123',
      result = '测试任务执行成功！这是一条测试消息，用于验证 SSE 通知推送功能是否正常工作。',
      status = 'completed',
    } = body;

    console.log('📦 请求参数:');
    console.log('  - agentId:', agentId);
    console.log('  - type:', type);
    console.log('  - fromAgentId:', fromAgentId);

    // 发送通知
    sendNotificationToAgent(agentId, {
      type: type as any,
      fromAgentId,
      toAgentId: agentId,
      taskId,
      result,
      status,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `已向 Agent ${agentId} 发送测试通知`,
      data: {
        agentId,
        type,
        fromAgentId,
        taskId,
      },
    });
  } catch (error) {
    console.error('❌ 发送测试通知失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '发送测试通知失败',
      },
      { status: 500 }
    );
  }
}
