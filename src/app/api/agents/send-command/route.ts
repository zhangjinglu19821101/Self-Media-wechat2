import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getWorkspaceId } from '@/lib/auth/context';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { createUserLLMClient } from '@/lib/llm/factory';
import { handleRouteError } from '@/lib/api/route-error-handler';
import { agentBuilder } from '@/lib/agent-builder';
import { conversationHistory } from '@/lib/services/conversation-history';
import { agentMemory } from '@/lib/services/agent-memory';
import { wsServer } from '@/lib/websocket-server';

/**
 * POST /api/agents/send-command
 * Agent 间指令发送接口
 *
 * 允许一个 Agent 向另一个 Agent 发送指令
 */
export async function POST(request: NextRequest) {
  console.log('📥 === 收到指令发送请求 ===');

  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    // BYOK: 获取 workspaceId 传递给 LLM 调用
    const workspaceId = await getWorkspaceId(request);

    const body = await request.json();
    const {
      fromAgentId,      // 发送指令的 Agent ID
      toAgentId,        // 接收指令的 Agent ID
      command,          // 指令内容
      commandType = 'instruction', // 指令类型：instruction/task/report
      priority = 'normal',         // 优先级：high/normal/low
      taskId,          // 🔥 可选的任务 ID（用于关联任务）
      metadata = {},             // 元数据
    } = body;

    console.log('📦 请求参数:');
    console.log('  - fromAgentId:', fromAgentId);
    console.log('  - toAgentId:', toAgentId);
    console.log('  - taskId:', taskId || 'N/A'); // 🔥 添加 taskId 日志
    console.log('  - commandType:', commandType);
    console.log('  - priority:', priority);
    console.log('  - command 长度:', command?.length || 0);
    console.log('  - command 内容（前200字符）:', command?.substring(0, 200));
    console.log('  - metadata:', metadata);

    // 验证必需参数
    if (!fromAgentId || !toAgentId || !command) {
      console.log('❌ 参数验证失败: 缺少必需参数');
      return NextResponse.json(
        {
          success: false,
          error: '缺少必需参数：fromAgentId, toAgentId, command',
        },
        { status: 400 }
      );
    }

    // 验证 Agent ID 是否有效
    const validAgents = ['A', 'B', 'C', 'D', 'insurance-c', 'insurance-d'];
    if (!validAgents.includes(fromAgentId) || !validAgents.includes(toAgentId)) {
      return NextResponse.json(
        {
          success: false,
          error: '无效的 Agent ID',
        },
        { status: 400 }
      );
    }

    // 获取接收指令的 Agent
    const toAgent = agentBuilder.getAgent(toAgentId as any);
    if (!toAgent) {
      return NextResponse.json(
        {
          success: false,
          error: `接收方 Agent ${toAgentId} 不存在`,
        },
        { status: 404 }
      );
    }

    // 🔥 获取 taskId（如果有）
    const newTaskId = taskId || '';

    // 构建指令消息
    const instructionMessage = `
【收到来自 Agent ${fromAgentId} 的指令】

指令类型：${commandType}
优先级：${priority}
发送时间：${new Date().toLocaleString('zh-CN')}

指令内容：
${command}

---
请按照指令要求执行任务，执行完成后向 Agent ${fromAgentId} 报告结果。
`;

    // 构建系统提示词（包含指令接收说明）
    let systemPrompt = toAgent.systemPrompt;
    systemPrompt += `

【指令接收能力】
作为 Agent ${toAgentId}，你具备接收和处理来自其他 Agent 指令的能力：

1. 接收指令：接收来自 Agent ${fromAgentId} 的指令
2. 理解指令：仔细阅读指令内容，明确任务要求和完成标准
3. 执行任务：按照指令要求执行具体任务
4. 报告结果：完成后向 Agent ${fromAgentId} 报告执行结果
5. 记录经验：将重要的经验记录到记忆系统

指令优先级处理：
- high（高优先级）：立即执行，优先处理
- normal（普通优先级）：正常处理
- low（低优先级）：可以稍后处理

收到指令后，请：
1. 确认收到指令
2. 说明你的执行计划
3. 开始执行任务
4. 完成后报告结果
`;

    // 构建消息列表
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: instructionMessage },
    ];

    // 创建或获取对话会话
    const sessionId = `agent-${fromAgentId}-to-${toAgentId}-${Date.now()}`;
    const conversation = await conversationHistory.createConversation({
      sessionId,
      agentId: toAgentId,
      metadata: {
        type: 'agent-to-agent',
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
      },
    });

    // 🔥 通过 WebSocket 推送给接收方 Agent
    console.log(`📡 准备通过 WebSocket 推送指令到 Agent ${toAgentId}`);
    const wsMessage = {
      type: 'new_command' as const,
      fromAgentId,
      toAgentId,
      command,
      commandType: commandType as 'instruction' | 'task' | 'report' | 'urgent',
      priority: priority as 'high' | 'normal' | 'low',
      timestamp: new Date().toISOString(),
      taskId: newTaskId, // 🔥 使用 newTaskId
      data: {
        conversationId: conversation.id,
        sessionId,
        ...(newTaskId && { taskId: newTaskId }), // 🔥 如果有 newTaskId，也包含在 data 中
      },
    };
    console.log('📦 WebSocket 消息内容:', JSON.stringify(wsMessage, null, 2));

    const wsSuccess = wsServer.sendToAgent(toAgentId, wsMessage);

    console.log(`📤 WebSocket push to Agent ${toAgentId}: ${wsSuccess ? '✅ Success' : '❌ Failed (agent not connected)'}`);

    // 检查 WebSocket 连接状态
    const wsConnectedClients = wsServer.getConnectedClients();
    console.log('📊 当前 WebSocket 连接状态:', wsConnectedClients);

    // 异步处理 LLM 响应并保存到对话历史
    // 不阻塞指令发送的响应
    processAgentResponse(messages, conversation.id, toAgentId, fromAgentId, taskId, workspaceId).catch(error => {
      console.error('Error processing agent response:', error);
    });

    // 🔥 创建通知到数据库（用于轮询，使用去重服务）
    try {
      const { createNotificationWithDeduplication } = await import('@/lib/services/notification-service-v2');

      const result = await createNotificationWithDeduplication({
        fromAgentId,
        toAgentId,
        notificationType: 'command',
        title: `新指令：${fromAgentId} → ${toAgentId}`,
        content: {
          fromAgentId,
          toAgentId,
          command,
          commandType,
          priority,
          ...(newTaskId && { taskId: newTaskId }), // 如果有 newTaskId，包含在 content 中
        },
        relatedTaskId: newTaskId, // 传递 newTaskId 作为去重依据
        priority,
        metadata: {
          conversationId: conversation.id,
          sessionId,
          ...metadata,
        },
      });

      if (result.success) {
        console.log(`✅ 通知已${result.existing ? '去重跳过（已存在）' : '创建'}: notificationId=${result.notificationId}, taskId=${newTaskId || 'N/A'}`);
      } else {
        console.error('❌ 创建通知失败:', result.error);
      }
    } catch (error) {
      console.error('❌ 创建通知异常:', error);
      // 不影响指令发送的成功响应
    }

    // 返回成功响应
    return NextResponse.json(
      {
        success: true,
        message: '指令已发送',
        data: {
          conversationId: conversation.id,
          sessionId,
          fromAgentId,
          toAgentId,
          commandType,
          priority,
          taskId: newTaskId, // 🔥 返回 newTaskId
          wsPushSuccess: wsSuccess,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error sending agent command:', error);
    return handleRouteError(error, '发送指令失败');
  }
}

/**
 * 异步处理 Agent 的响应并保存到对话历史
 */
async function processAgentResponse(
  messages: any[],
  conversationId: string,
  toAgentId: string,
  fromAgentId: string,
  taskId?: string, // 🔥 添加 taskId 参数
  workspaceId?: string // BYOK: 传入 workspaceId 以使用用户 API Key
) {
  try {
    // BYOK: 优先使用用户 Key
    const { client } = await createUserLLMClient(workspaceId);

    let responseContent = '';

    // 调用 LLM 生成响应
    const llmStream = client.stream(messages, {
      temperature: 0.7,
    });

    for await (const chunk of llmStream) {
      if (chunk.content) {
        const text = chunk.content.toString();
        responseContent += text;
      }
    }

    // 保存响应到对话历史
    if (responseContent.trim()) {
      console.log('📝 =======================================');
      console.log(`📝 Agent ${toAgentId} 完整响应内容:`);
      console.log('📝 =======================================');
      console.log(responseContent);
      console.log('📝 =======================================');
      console.log(`📝 响应长度: ${responseContent.length} 字符`);
      console.log('📝 =======================================');

      await conversationHistory.addMessage({
        conversationId,
        role: 'assistant',
        content: responseContent,
        metadata: {
          isCommandResponse: true,
          fromAgentId,
        },
      });

      console.log(`✅ Agent ${toAgentId} response saved to conversation ${conversationId}`);

      // 🔥 检测 Agent B 的响应中是否包含任务拆解结果（JSON 格式）
      if (toAgentId === 'B' && fromAgentId === 'A') {
        console.log('🔍 =======================================');
        console.log('🔍 Agent B 检测到响应，检查是否包含任务拆解结果...');
        console.log('🔍 =======================================');

        // 尝试提取 JSON 格式的拆解结果
        const jsonMatch = responseContent.match(/```json\s*([\s\S]*?)\s*```/);

        if (jsonMatch) {
          console.log('🔍 找到 JSON 格式的拆解结果');
          console.log('🔍 JSON 代码块内容:');
          console.log(jsonMatch[0]);
          console.log('🔍 =======================================');

          try {
            const splitResult = JSON.parse(jsonMatch[1]);
            console.log('✅ 拆解结果解析成功:', splitResult);

            // 🔥 发送 task_result 通知给 Agent A
            try {
              const { db } = await import('@/lib/db');
              const { agentNotifications } = await import('@/lib/db/schema');

              const notificationId = `notif-A-B-split-${Date.now()}`;

              await db.insert(agentNotifications).values({
                notificationId,
                fromAgentId: 'B',
                toAgentId: 'A',
                notificationType: 'result',
                title: `任务拆解完成：${fromAgentId} → ${toAgentId}`,
                content: JSON.stringify({
                  fromAgentId: 'B',
                  toAgentId: 'A',
                  result: JSON.stringify(splitResult),
                  status: 'completed',
                  data: {
                    splitResult,
                    subTasksCount: splitResult.subTasks?.length || 0,
                  },
                }),
                relatedTaskId: taskId, // 🔥 使用原始任务的 taskId
                status: 'unread',
                priority: 'high',
                isRead: false,
                metadata: {
                  splitResult,
                  subTasksCount: splitResult.subTasks?.length || 0,
                },
              });

              console.log(`✅ 拆解结果通知已发送给 Agent A: notificationId=${notificationId}, taskId=${taskId}`);

              // 🔥 新增：通过 WebSocket 推送拆解结果给 Agent A
              console.log(`📡 准备通过 WebSocket 推送拆解结果到 Agent A`);
              const wsMessage = {
                type: 'task_result' as const,
                fromAgentId: 'B',
                toAgentId: 'A',
                taskId: taskId,
                result: JSON.stringify(splitResult),
                status: 'completed',
                notificationId: notificationId,  // 🔥 添加 notificationId
                timestamp: new Date().toISOString(),
              };
              console.log('📦 WebSocket 消息内容:', JSON.stringify(wsMessage, null, 2));

              const wsSuccess = wsServer.sendToAgent('A', wsMessage);
              console.log(`📤 WebSocket push to Agent A: ${wsSuccess ? '✅ Success' : '❌ Failed (agent not connected)'}`);
            } catch (error) {
              console.error('❌ 发送拆解结果通知时出错:', error);
            }
          } catch (error) {
            console.error('❌ 解析拆解结果 JSON 失败:');
            console.error('❌ JSON 内容:', jsonMatch[1]);
            console.error('❌ 错误详情:', error);
          }
        } else {
          console.log('⚠️ 未找到 JSON 格式的拆解结果');
          console.log('⚠️ 响应内容（前500字符）:', responseContent.substring(0, 500));
          console.log('⚠️ 响应内容包含"subTasks"吗?', responseContent.includes('subTasks'));
          console.log('⚠️ 响应内容包含"```json"吗?', responseContent.includes('```json'));
          console.log('⚠️ 响应内容包含"```"吗?', responseContent.includes('```'));
          console.log('⚠️ =======================================');
        }
      }
    }
  } catch (error) {
    console.error('Error processing agent response:', error);
  }
}
