import { NextRequest, NextResponse } from 'next/server';
import { agentBuilder } from '@/lib/agent-builder';
import { isWritingAgent } from '@/lib/agents/agent-registry';
import { conversationHistory } from '@/lib/services/conversation-history';
import { TaskManager } from '@/lib/services/task-manager';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { createUserLLMClient } from '@/lib/llm/factory';
import { handleRouteError } from '@/lib/api/route-error-handler';
import { getWorkspaceId } from '@/lib/auth/context';
import { sendNotificationToAgent } from '@/app/api/agents/sse-manager';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '@/lib/db';
import { agentTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { SplitRetryManager } from '@/lib/services/split-retry-manager';
import { CommandResultService } from '@/lib/services/command-result-service';

/**
 * 场景类型（替代已删除的 @/lib/global-schedule/types）
 */
type ScenarioType = 'processing' | 'success' | 'failed';

/**
 * 任务参数类型（替代已删除的 @/lib/global-schedule/types）
 */
interface TaskParams {
  taskType: 'draft_6h' | 'final_7h' | 'normal_create';
  taskId: string;
  createRequirement?: {
    contentDirection: string;
    wordCount: string;
    materialSource: string;
    complianceRule: string;
  };
  extraRemark?: string;
}

/**
 * 场景标识标签映射
 */
const SCENARIO_LABELS = {
  processing: '处理中',
  success: '成功',
  failed: '失败',
};

/**
 * 场景同步到dailyTask表
 */
async function syncScenarioToCommandResults(
  scenarioType: ScenarioType,
  taskId: string,
  taskName: string,
  message: string,
  extraFields?: {
    failureReason?: string;
    triggerSource?: string;
  }
): Promise<void> {
  try {
    const content = `【场景标识：${SCENARIO_LABELS[scenarioType]}】${message}`;

    // 生成场景唯一的 commandId
    const timestamp = Date.now();
    const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const commandId = `scenario-${scenarioType}-${safeTaskId}-${timestamp}`;

    const requestBody: any = {
      commandId, // 添加必填的 commandId 字段
      taskId,
      fromAgentId: 'insurance-d',
      toAgentId: 'A',
      originalCommand: taskName,
      executionStatus: scenarioType === 'processing' ? 'in_progress' : scenarioType,
      executionResult: content,
      scenarioType,
      taskName,
    };

    if (extraFields?.failureReason) {
      requestBody.failureReason = extraFields.failureReason;
    }

    if (extraFields?.triggerSource) {
      requestBody.triggerSource = extraFields.triggerSource;
    }

    const response = await fetch(`http://localhost:5000/api/command-results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': process.env.INTERNAL_API_TOKEN || 'internal-svc-token-2025-07',
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      console.log(`✅ 场景同步成功: ${SCENARIO_LABELS[scenarioType]} - ${taskId}`);
    } else {
      console.log(`⚠️ 场景同步失败: ${SCENARIO_LABELS[scenarioType]} - ${taskId}`);
    }
  } catch (error) {
    console.error(`❌ 场景同步异常: ${scenarioType} - ${taskId}`, error);
  }
}

/**
 * 保存文章到文件系统
 */
async function saveArticleToFile(
  content: string,
  taskId: string,
  taskName: string
): Promise<void> {
  try {
    // 获取项目根目录（workspace）
    const projectRoot = process.env.COZE_WORKSPACE_PATH || '/workspace/projects';

    // 创建保存路径：./backup/agent_log/insurance-d/文章初稿/
    const saveDir = path.join(projectRoot, 'backup', 'agent_log', 'insurance-d', '文章初稿');

    // 确保目录存在
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
      console.log(`📁 创建目录: ${saveDir}`);
    }

    // 生成文件名：文章初稿_YYYYMMDD_HHMMSS_{taskId}.md
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '').slice(0, 19).replace('T', '_');
    const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `文章初稿_${timestamp}_${safeTaskId}.md`;
    const filepath = path.join(saveDir, filename);

    // 写入文件
    fs.writeFileSync(filepath, content, 'utf-8');
    console.log(`✅ 文章已保存到文件: ${filepath}`);
    console.log(`   文件大小: ${content.length} 字符`);

  } catch (error) {
    console.error(`❌ 保存文章到文件失败:`, error);
  }
}

/**
 * 参数校验函数
 */
function validateTaskParams(params: any): { valid: boolean; error?: string } {
  // 校验必填参数
  if (!params.taskType || !['draft_6h', 'final_7h', 'normal_create'].includes(params.taskType)) {
    return { valid: false, error: '参数taskType错误，仅支持draft_6h/final_7h/normal_create' };
  }

  if (!params.taskId) {
    return { valid: false, error: '参数taskId缺失' };
  }

  if (!params.createRequirement) {
    return { valid: false, error: '参数createRequirement缺失' };
  }

  const req = params.createRequirement;
  if (!req.contentDirection || !req.wordCount || !req.materialSource || !req.complianceRule) {
    return { valid: false, error: '参数createRequirement缺失必填子项' };
  }

  return { valid: true };
}

/**
 * 构建system prompt
 */
function buildSystemPrompt(params: TaskParams): string {
  let prompt = `你是一个保险内容创作助手。`;

  if (params.createRequirement) {
    prompt += `\n\n【创作要求】`;
    prompt += `\n- 内容方向：${params.createRequirement.contentDirection}`;
    prompt += `\n- 字数要求：${params.createRequirement.wordCount}字`;
    prompt += `\n- 素材来源：${params.createRequirement.materialSource}`;
    prompt += `\n- 合规规则：${params.createRequirement.complianceRule}`;
  }

  if (params.extraRemark) {
    prompt += `\n\n【特别说明】`;
    prompt += `\n${params.extraRemark}`;
  }

  return prompt;
}

/**
 * POST /api/commands/send
 * Agent 间指令发送接口
 *
 * 允许一个 Agent 向另一个 Agent 发送指令
 */
export async function POST(request: NextRequest) {
  console.log('📥 === /api/commands/send 收到指令发送请求 ===');

  try {
    // BYOK: 获取 workspaceId
    const workspaceId = await getWorkspaceId(request);

    const body = await request.json();
    const {
      fromAgentId,      // 发送指令的 Agent ID
      toAgentId,        // 接收指令的 Agent ID
      command,          // 指令内容
      commandType = 'instruction', // 指令类型：instruction/task/report/urgent
      priority = 'normal',         // 优先级：high/normal/low
      metadata = {},             // 元数据
      taskId,                   // 🔥 可选的任务 ID
    } = body;

    console.log('📦 请求参数:');
    console.log('  - fromAgentId:', fromAgentId);
    console.log('  - toAgentId:', toAgentId);
    console.log('  - commandType:', commandType);
    console.log('  - priority:', priority);
    console.log('  - taskId:', taskId); // 🔥 记录 taskId
    console.log('  - command 长度:', command?.length || 0);
    console.log('  - command 内容（前200字符）:', command?.substring(0, 200));
    console.log('  - command 完整内容:');
    console.log(command);
    console.log('  - metadata:', JSON.stringify(metadata, null, 2));

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
    console.log(`[DEBUG] 验证 Agent ID: fromAgentId="${fromAgentId}", toAgentId="${toAgentId}"`);
    console.log(`[DEBUG] validAgents:`, validAgents);
    console.log(`[DEBUG] fromAgentId 是否有效:`, validAgents.includes(fromAgentId));
    console.log(`[DEBUG] toAgentId 是否有效:`, validAgents.includes(toAgentId));

    if (!validAgents.includes(fromAgentId) || !validAgents.includes(toAgentId)) {
      console.log(`[DEBUG] Agent ID 验证失败`);
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

    // 🔥 创建任务记录到 agentTasks 表（使用带防重功能的 TaskManager.createTask）
    // 如果传入了 taskId（拆解任务），使用指定的 taskId；否则生成新的
    const finalTaskId = taskId || `task-${fromAgentId}-to-${toAgentId}-${Date.now()}`;
    
    // 🔥 使用带防重重的 TaskManager.createTask，它内部会处理防重检查
    console.log(`🔍 [send/route] 准备创建任务: ${finalTaskId}`);
    const createdTask = await TaskManager.createTask({
      taskId: finalTaskId,
      fromAgentId,
      toAgentId,
      command,
      commandType,
      priority,
      status: taskId ? 'splitting' : 'pending', // 🔥 如果是拆解任务，状态为 splitting（小写）
      metadata: {
        conversationId: conversation.id,
        sessionId,
      },
    });
    
    console.log(`✅ [send/route] 任务处理完成: ${finalTaskId}`);

    // 构建指令消息
    const instructionMessage = `
【收到来自 Agent ${fromAgentId} 的指令】

任务ID：${finalTaskId}
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

    // 🔥 构建 LLM 消息列表（用于异步处理响应）
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: instructionMessage },
    ];

    // 🔥 通过 SSE 推送给接收方 Agent
    console.log(`📡 准备通过 SSE 推送指令到 Agent ${toAgentId}`);
    sendNotificationToAgent(toAgentId, {
      type: 'new_command',
      fromAgentId,
      toAgentId,
      command,
      commandType: commandType as 'instruction' | 'task' | 'report' | 'urgent',
      priority: priority as 'high' | 'normal' | 'low',
      timestamp: new Date().toISOString(),
      taskId,
      message: `收到来自 Agent ${fromAgentId} 的新指令`,
    });
    console.log(`✅ 已向 Agent ${toAgentId} 推送新指令通知`);

    // 🔥 异步处理 LLM 响应并保存到对话历史
    // 不阻塞指令发送的响应
    processAgentResponse(messages, conversation.id, toAgentId, fromAgentId, taskId, sessionId, command, systemPrompt, workspaceId)
      .then(() => {
        console.log(`✅ Agent ${toAgentId} 响应处理完成`);
      })
      .catch(error => {
        console.error('Error processing agent response:', error);
      });

    console.log(`📤 指令已发送，Agent ${toAgentId} 响应处理已在后台启动`);

    // 返回成功响应
    return NextResponse.json(
      {
        success: true,
        message: '指令已发送',
        data: {
          taskId,
          conversationId: conversation.id,
          sessionId,
          fromAgentId,
          toAgentId,
          commandType,
          priority,
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
  taskId: string,
  sessionId: string,
  originalCommand: string,
  agentSystemPrompt?: string, // 🔥 新增：Agent 的系统提示词
  workspaceId?: string // BYOK: 传入 workspaceId
) {
  try {
    console.log(`🤖 开始处理 Agent ${toAgentId} 的响应...`);
    console.log(`📋 任务ID: ${taskId}`);

    // 🔥 将任务状态更新为 in_progress（表示 Agent 已开始执行）
    try {
      const statusUpdateResponse = await fetch(`http://localhost:5000/api/agents/tasks/${taskId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': process.env.INTERNAL_API_TOKEN || 'internal-svc-token-2025-07',
        },
        body: JSON.stringify({
          status: 'in_progress',
        }),
      });

      if (statusUpdateResponse.ok) {
        console.log(`✅ 任务状态已更新为 in_progress: ${taskId}`);

        // 🔥 场景同步：处理中
        await syncScenarioToCommandResults(
          'processing',
          taskId,
          originalCommand,
          `任务已启动，正在执行中...`
        );
      } else {
        console.log(`⚠️ 任务状态更新失败: ${taskId}`);
      }
    } catch (error) {
      console.log(`⚠️ 任务状态更新异常:`, error);
    }

    // BYOK: 使用传入的 workspaceId
    const { client } = await createUserLLMClient(workspaceId);

    let responseContent = '';

    // 调用 LLM 生成响应
    console.log(`🔄 开始调用 LLM 生成响应...`);
    const llmStream = client.stream(messages, {
      temperature: 0.7,
    });

    let chunkCount = 0;
    for await (const chunk of llmStream) {
      if (chunk.content) {
        const text = chunk.content.toString();
        responseContent += text;
        chunkCount++;
        if (chunkCount % 10 === 0) {
          console.log(`📝 Agent ${toAgentId} 响应片段 ${chunkCount}:`, text.substring(0, 30));
        }
      }
    }

    console.log(`✅ Agent ${toAgentId} 完整响应: ${chunkCount} 个片段, ${responseContent.length} 字符`);

    // 保存响应到对话历史
    if (responseContent.trim()) {
      await conversationHistory.addMessage({
        conversationId,
        role: 'assistant',
        content: responseContent,
        metadata: {
          isCommandResponse: true,
          fromAgentId,
          taskId,
        },
      });

      console.log(`✅ Agent ${toAgentId} 响应已保存到对话 ${conversationId}`);
    } else {
      console.log(`⚠️ Agent ${toAgentId} 未生成任何响应内容`);
    }

    // 🔥🔥 新增：如果是 Agent B 的拆解任务，使用重试机制处理 JSON
    if (toAgentId === 'B' && originalCommand.includes('任务拆解指令')) {
      console.log(`🔍 检测到 Agent B 的拆解任务响应，启动重试机制...`);
      console.log(`📝 Agent B 响应内容（前500字符）:`, responseContent.substring(0, 500));

      try {
        // 使用重试管理器处理拆解结果
        const retryResult = await SplitRetryManager.handleSplitResponse(
          responseContent,
          taskId,
          conversationId,
          toAgentId,
          fromAgentId,
          originalCommand,
          agentSystemPrompt || messages[0]?.content || ''
        );

        if (retryResult.success) {
          console.log(`✅ 拆解任务处理成功（尝试 ${retryResult.attempts} 次）`);
          
          // 🔥 更新 responseContent 为正确的 JSON 格式
          if (retryResult.data) {
            responseContent = JSON.stringify(retryResult.data, null, 2);
            console.log(`📝 已更新 responseContent 为 JSON 格式（${responseContent.length} 字符）`);
          }
        } else {
          console.log(`❌ 拆解任务处理失败（尝试 ${retryResult.attempts} 次）: ${retryResult.error}`);
          
          // 更新任务状态为 failed
          try {
            await fetch(`http://localhost:5000/api/agents/tasks/${taskId}/result`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-token': process.env.INTERNAL_API_TOKEN || 'internal-svc-token-2025-07',
              },
              body: JSON.stringify({
                result: `拆解任务失败（尝试 ${retryResult.attempts} 次）：${retryResult.error}`,
                status: 'failed',
              }),
            });
          } catch (error) {
            console.error('❌ 更新任务状态失败:', error);
          }
        }
      } catch (error) {
        console.error('❌ 拆解任务处理异常:', error);
      }
    }

    // 🔥 将响应作为执行结果保存到任务
    try {
      const resultResponse = await fetch(`http://localhost:5000/api/agents/tasks/${finalTaskId}/result`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': process.env.INTERNAL_API_TOKEN || 'internal-svc-token-2025-07',
        },
        body: JSON.stringify({
          result: responseContent,
          status: 'completed',
        }),
      });

      if (resultResponse.ok) {
        console.log(`✅ 任务执行结果已保存: ${finalTaskId}`);

        // 🔥🔥 关键修复：通过 SSE 推送执行结果给发送方 Agent（Agent A）
        console.log(`📡 准备通过 SSE 推送执行结果到 Agent ${fromAgentId}`);

        sendNotificationToAgent(fromAgentId, {
          type: 'task_result',
          fromAgentId: toAgentId,
          toAgentId: fromAgentId,
          taskId: finalTaskId,
          result: responseContent,
          status: 'completed',
          timestamp: new Date().toISOString(),
          message: `Agent ${toAgentId} 已完成任务`,
        });

        console.log(`✅ 已向 Agent ${fromAgentId} 推送任务结果通知`);

        // 🔥🔥 同步保存结果到 dailyTask 表（用于 Agent A 在"执行结果"面板中查看）
        try {
          console.log(`📡 准备保存结果到 dailyTask 表...`);

          const commandResultService = new CommandResultService();
          const commandId = `response-${finalTaskId}-${Date.now()}`;
          
          // 使用公共方法插入（带去重检查）
          const result = await commandResultService.createDailyTaskWithDuplicateCheck({
            taskId: finalTaskId,
            commandId: commandId,
            relatedTaskId: finalTaskId,
            taskTitle: originalCommand?.substring(0, 100) || `任务 ${finalTaskId}`,
            taskDescription: originalCommand || `指令执行结果`,
            executor: toAgentId,
            fromAgentId: toAgentId,
            toAgentId: fromAgentId,
            originalCommand: originalCommand,
            executionStatus: 'completed',
            executionResult: responseContent,
            outputData: {},
            metrics: {
              responseLength: responseContent.length,
              completedAt: new Date().toISOString(),
            },
          });

          if (result.isDuplicate) {
            console.log(`⚠️ 任务已存在，跳过创建: ${finalTaskId}`);
          } else {
            console.log(`✅ 结果已同步保存到 dailyTask 表:`, result.data?.id);

            // 🔥 场景同步：成功
            await syncScenarioToCommandResults(
              'success',
              finalTaskId,
              originalCommand,
              `任务执行完成，生成内容长度：${responseContent.length}字`
            );

            // 🔥 保存文章到文件系统（仅针对写作类 Agent）
            if (isWritingAgent(toAgentId)) {
              await saveArticleToFile(responseContent, finalTaskId, originalCommand);
            }

            // 🔥 打印完整响应信息
            console.log(`\n${'='.repeat(80)}`);
            console.log(`📊 Agent ${toAgentId} 完整响应信息`);
            console.log(`${'='.repeat(80)}`);
            console.log(`✅ 任务状态: 已完成`);
            console.log(`📝 任务ID: ${finalTaskId}`);
            console.log(`📤 发送方: ${fromAgentId}`);
            console.log(`📥 接收方: ${toAgentId}`);
            console.log(`⏰ 完成时间: ${new Date().toLocaleString('zh-CN')}`);
            console.log(`📊 响应统计:`);
            console.log(`   - 响应长度: ${responseContent.length} 字符`);
            console.log(`   - 响应行数: ${responseContent.split('\n').length} 行`);
            console.log(`\n📄 原始指令:`);
            console.log(originalCommand);
            console.log(`\n📝 完整响应内容:`);
            console.log(responseContent);
            console.log(`${'='.repeat(80)}\n`);
          }
        } catch (e) {
          console.log(`⚠️ 保存到 dailyTask 表异常:`, e);
        }

      } else {
        console.log(`⚠️ 任务执行结果保存失败: ${finalTaskId}`);
      }
    } catch (error) {
      console.log(`⚠️ 任务执行结果保存异常:`, error);
    }
  } catch (error) {
    console.error(`❌ 处理 Agent ${toAgentId} 响应失败:`, error);

    const errorMessage = error instanceof Error ? error.message : '处理响应失败';

    // 🔥 标记任务失败
    try {
      await fetch(`http://localhost:5000/api/agents/tasks/${sessionId}/result`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': process.env.INTERNAL_API_TOKEN || 'internal-svc-token-2025-07',
        },
        body: JSON.stringify({
          result: errorMessage,
          status: 'failed',
        }),
      });

      // 🔥 场景同步：失败（同时也插入失败记录到dailyTask）
      await syncScenarioToCommandResults(
        'failed',
        taskId,
        originalCommand,
        `任务执行失败`,
        {
          failureReason: errorMessage,
          triggerSource: 'ts_schedule',
        }
      );

      // 🔥 打印完整失败信息
      console.log(`\n${'='.repeat(80)}`);
      console.log(`❌ Agent ${toAgentId} 任务失败`);
      console.log(`${'='.repeat(80)}`);
      console.log(`❌ 任务状态: 失败`);
      console.log(`📝 任务ID: ${taskId}`);
      console.log(`📤 发送方: ${fromAgentId}`);
      console.log(`📥 接收方: ${toAgentId}`);
      console.log(`⏰ 失败时间: ${new Date().toLocaleString('zh-CN')}`);
      console.log(`📄 原始指令:`);
      console.log(originalCommand);
      console.log(`\n❌ 错误信息:`);
      console.log(errorMessage);
      console.log(`${'='.repeat(80)}\n`);
    } catch (e) {
      console.error(`❌ 标记任务失败时出错:`, e);
    }
  }
}
