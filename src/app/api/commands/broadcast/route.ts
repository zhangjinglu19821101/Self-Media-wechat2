import { NextRequest, NextResponse } from 'next/server';
import { agentBuilder } from '@/lib/agent-builder';
import { conversationHistory } from '@/lib/services/conversation-history';
import { wsServer } from '@/lib/websocket-server';

/**
 * POST /api/commands/broadcast
 * 广播指令到所有 Agent
 *
 * 向所有指定的 Agent 发送相同的指令
 */
export async function POST(request: NextRequest) {
  console.log('📥 === /api/commands/broadcast 收到广播指令请求 ===');

  try {
    const body = await request.json();
    const {
      fromAgentId,      // 发送指令的 Agent ID
      command,          // 指令内容（所有 Agent 相同）
      commandType = 'instruction', // 指令类型
      priority = 'normal',         // 优先级
      targetAgentIds = [],        // 目标 Agent 列表，为空则发送给所有 Agent
      metadata = {},             // 元数据
    } = body;

    console.log('📦 请求参数:');
    console.log('  - fromAgentId:', fromAgentId);
    console.log('  - targetAgentIds:', targetAgentIds.length > 0 ? targetAgentIds : '所有 Agent');
    console.log('  - commandType:', commandType);
    console.log('  - priority:', priority);

    // 验证必需参数
    if (!fromAgentId || !command) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必需参数：fromAgentId, command',
        },
        { status: 400 }
      );
    }

    // 确定目标 Agent 列表
    const allAgents = ['A', 'B', 'C', 'D', 'insurance-c', 'insurance-d'];
    const targets = targetAgentIds.length > 0 ? targetAgentIds : allAgents.filter(id => id !== fromAgentId);

    console.log('📯 目标 Agent 列表:', targets);

    // 验证 Agent ID
    const validTargets = targets.filter(id => allAgents.includes(id));
    if (validTargets.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '没有有效的目标 Agent',
        },
        { status: 400 }
      );
    }

    // 并发发送指令给所有目标 Agent
    const results = await Promise.allSettled(
      validTargets.map(async (toAgentId) => {
        try {
          // 获取接收方 Agent
          const toAgent = agentBuilder.getAgent(toAgentId as any);
          if (!toAgent) {
            throw new Error(`Agent ${toAgentId} 不存在`);
          }

          // 构建指令消息
          const instructionMessage = `
【收到来自 Agent ${fromAgentId} 的广播指令】

指令类型：${commandType}
优先级：${priority}
发送时间：${new Date().toLocaleString('zh-CN')}

指令内容：
${command}

---
请按照指令要求执行任务，执行完成后向 Agent ${fromAgentId} 报告结果。
`;

          // 创建对话会话
          const sessionId = `broadcast-${fromAgentId}-to-${toAgentId}-${Date.now()}`;
          const conversation = await conversationHistory.createConversation({
            sessionId,
            agentId: toAgentId,
            metadata: {
              type: 'broadcast',
              fromAgentId,
              toAgentId,
              commandType,
              priority,
            },
          });

          // 保存指令到对话历史
          await conversationHistory.addMessage({
            conversationId: conversation.id,
            role: 'user',
            content: instructionMessage,
            metadata: {
              isCommand: true,
              fromAgentId,
              commandType,
              priority,
              isBroadcast: true,
            },
          });

          // 通过 WebSocket 推送
          const wsMessage = {
            type: 'new_command' as const,
            fromAgentId,
            toAgentId,
            command,
            commandType: commandType as 'instruction' | 'task' | 'report' | 'urgent',
            priority: priority as 'high' | 'normal' | 'low',
            timestamp: new Date().toISOString(),
            data: {
              conversationId: conversation.id,
              sessionId,
              isBroadcast: true,
            },
          };

          const wsSuccess = wsServer.sendToAgent(toAgentId, wsMessage);

          return {
            agentId: toAgentId,
            success: true,
            conversationId: conversation.id,
            wsPushSuccess: wsSuccess,
          };
        } catch (error) {
          return {
            agentId: toAgentId,
            success: false,
            error: error instanceof Error ? error.message : '未知错误',
          };
        }
      })
    );

    // 统计结果
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failedCount = results.length - successCount;

    console.log(`✅ 广播完成：成功 ${successCount}，失败 ${failedCount}`);

    return NextResponse.json(
      {
        success: true,
        message: `指令已发送到 ${successCount} 个 Agent`,
        data: {
          total: results.length,
          success: successCount,
          failed: failedCount,
          results: results.map((r, index) => ({
            agentId: validTargets[index],
            status: r.status === 'fulfilled' ? r.value.status : 'rejected',
            data: r.status === 'fulfilled' ? r.value : null,
            error: r.status === 'rejected' ? r.reason.message : null,
          })),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in /api/commands/broadcast:', error);

    return NextResponse.json(
      {
        success: false,
        error: '广播指令失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
