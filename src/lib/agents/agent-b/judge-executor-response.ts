/**
 * Agent B 对话判断功能
 * Agent B 与执行 Agent 进行对话，判断执行 Agent 是否理解任务
 */

import { getDatabase, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { getLLMClient, callLLM } from '@/lib/agent-llm';

// === 真实 LLM 调用 ===
async function realLLMCall(prompt: string, executorAgentName: string, agentId: string = 'agent-b'): Promise<string> {
  console.log(`[Agent B] 调用真实 LLM，Agent ID: ${agentId}`);
  
  const systemPrompt = `你是 Agent B，负责与执行 Agent 进行对话，判断执行 Agent 是否理解任务。

你的职责：
1. 用简洁明了的语言与执行 Agent 沟通
2. 询问执行 Agent 是否理解任务
3. 必要时进行追问
4. 判断执行 Agent 的理解程度

执行 Agent: ${executorAgentName}
`;

  try {
    const response = await callLLM(
      agentId,
      `与执行 Agent ${executorAgentName} 对话`,
      systemPrompt,
      prompt
    );
    return response;
  } catch (error) {
    console.error('[Agent B] LLM 调用失败:', error);
    throw error;
  }
}

// === Agent 名称映射 ===

/**
 * 获取 Agent 显示名称
 */
export function getAgentName(agentId: string): string {
  const agentNames: Record<string, string> = {
    'insurance-c': '保险运营（insurance-c）',
    'insurance-d': '保险内容（insurance-d）',
    'insurance-xiaohongshu': '小红书创作（insurance-xiaohongshu）',
    'insurance-zhihu': '知乎创作（insurance-zhihu）',
    'insurance-toutiao': '头条创作（insurance-toutiao）',
    'deai-optimizer': '去AI化优化（deai-optimizer）',
    'insurance-a': '保险总裁（insurance-a）',
    'agent-t': '技术负责人（Agent T）',
    'agent-b': '流程协调者（Agent B）',
    'agent-a': '总裁（Agent A）',
  };
  return agentNames[agentId] || agentId;
}

// === 类型定义 ===

export interface DialogueContext {
  sessionId: string; // 对话会话 ID
  executorAgentId: string; // 执行 Agent ID（如 'insurance-c'）
  taskTitle: string; // 任务标题
  taskDescription: string; // 任务描述
  commandResultId: string; // 指令结果 ID
}

export interface DialogueMessage {
  role: 'agent_b' | 'executor'; // 角色：Agent B 或执行 Agent
  content: string; // 消息内容
  isUnderstand: boolean; // 是否理解任务
  timestamp: Date; // 时间戳
}

export interface DialogueResult {
  sessionId: string;
  executorAgentId: string; // 执行 Agent ID（如 'insurance-c'）
  messages: DialogueMessage[];
  isUnderstand: boolean; // 执行 Agent 是否理解任务
  roundCount: number; // 对话轮数
  completedReason: 'understood' | 'timeout' | 'max_rounds' | 'error'; // 完成原因
  error?: string; // 错误信息
}

// === 配置 ===

const MAX_ROUNDS = 10; // 最大对话轮数
const ROUND_TIMEOUT = 30 * 1000; // 每轮超时时间（30 秒）
const TOTAL_TIMEOUT = 5 * 60 * 1000; // 总超时时间（5 分钟）

// === 对话判断函数 ===

/**
 * Agent B 判断执行 Agent 是否理解任务
 * @param context 对话上下文
 * @returns 对话结果
 */
export async function judgeExecutorResponse(context: DialogueContext): Promise<DialogueResult> {
  const executorAgentName = getAgentName(context.executorAgentId);
  console.log(`[Agent B] 开始判断执行 Agent 是否理解任务...`);
  console.log(`[Agent B] 执行 Agent: ${executorAgentName} (ID: ${context.executorAgentId})`);
  console.log(`[Agent B] 任务: ${context.taskTitle}`);

  const db = getDatabase();
  const messages: DialogueMessage[] = [];
  let isUnderstand = false;
  let completedReason: DialogueResult['completedReason'] = 'error';
  const startTime = Date.now();

  try {
    // === 步骤 1：生成第一个问题 ===
    const firstQuestion = await generateFirstQuestion(context, executorAgentName);
    console.log(`[Agent B] 第 1 轮对话 - Agent B: ${firstQuestion}`);

    // 记录 Agent B 的消息
    await recordInteraction(context, 'agent_b', firstQuestion, false);
    messages.push({
      role: 'agent_b',
      content: firstQuestion,
      isUnderstand: false,
      timestamp: new Date(),
    });

    // === 步骤 2：多轮对话 ===
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      // 检查总超时
      if (Date.now() - startTime > TOTAL_TIMEOUT) {
        console.log(`[Agent B] 总超时，结束对话`);
        completedReason = 'timeout';
        break;
      }

      // 获取执行 Agent 的回复
      console.log(`[Agent B] 等待执行 Agent (${executorAgentName}) 的回复...`);

      // 模拟获取执行 Agent 的回复
      // 实际场景中，这里需要调用执行 Agent 的接口获取回复
      const executorResponse = await getExecutorResponse(
        context.executorAgentId,
        executorAgentName,
        firstQuestion,
        messages
      );

      console.log(`[Agent B] 第 ${round} 轮对话 - ${executorAgentName}: ${executorResponse}`);

      // 分析回复，判断是否理解任务
      const understandResult = await analyzeUnderstand(executorResponse, context, executorAgentName);

      // 记录执行 Agent 的消息
      await recordInteraction(context, 'executor', executorResponse, understandResult.isUnderstand);
      messages.push({
        role: 'executor',
        content: executorResponse,
        isUnderstand: understandResult.isUnderstand,
        timestamp: new Date(),
      });

      // 检查是否理解
      if (understandResult.isUnderstand) {
        console.log(`[Agent B] ${executorAgentName} 已理解任务`);
        isUnderstand = true;
        completedReason = 'understood';
        break;
      }

      // 如果未理解，生成下一个问题
      if (round < MAX_ROUNDS) {
        const nextQuestion = await generateFollowUpQuestion(context, messages, executorAgentName);
        console.log(`[Agent B] 第 ${round + 1} 轮对话 - Agent B: ${nextQuestion}`);

        // 记录 Agent B 的消息
        await recordInteraction(context, 'agent_b', nextQuestion, false);
        messages.push({
          role: 'agent_b',
          content: nextQuestion,
          isUnderstand: false,
          timestamp: new Date(),
        });
      } else {
        console.log(`[Agent B] 达到最大对话轮数，结束对话`);
        completedReason = 'max_rounds';
      }
    }

    // === 步骤 3：更新对话状态 ===
    await updateDialogueStatus(context, messages.length, isUnderstand, completedReason);

    // === 步骤 4：返回对话结果 ===
    const result: DialogueResult = {
      sessionId: context.sessionId,
      executorAgentId: context.executorAgentId,
      messages,
      isUnderstand,
      roundCount: messages.length,
      completedReason,
    };

    console.log(`[Agent B] 对话完成，共 ${result.roundCount} 轮`);
    console.log(`[Agent B] ${executorAgentName} 是否理解: ${isUnderstand ? '是' : '否'}`);

    return result;
  } catch (error) {
    console.error(`[Agent B] 对话判断失败:`, error);

    completedReason = 'error';

    const result: DialogueResult = {
      sessionId: context.sessionId,
      executorAgentId: context.executorAgentId,
      messages,
      isUnderstand: false,
      roundCount: messages.length,
      completedReason,
      error: error instanceof Error ? error.message : String(error),
    };

    return result;
  }
}

/**
 * 生成第一个问题
 */
async function generateFirstQuestion(
  context: DialogueContext,
  executorAgentName: string
): Promise<string> {
  const prompt = `
任务信息：
- 任务标题：${context.taskTitle}
- 任务描述：${context.taskDescription}
- 执行 Agent: ${executorAgentName}
`;

  const response = await realLLMCall(prompt, executorAgentName);

  return response;
}

/**
 * 生成后续问题
 */
async function generateFollowUpQuestion(
  context: DialogueContext,
  history: DialogueMessage[],
  executorAgentName: string
): Promise<string> {
  const lastMessage = history[history.length - 1];
  const prompt = `
任务信息：
- 任务标题：${context.taskTitle}
- 任务描述：${context.taskDescription}
- 执行 Agent: ${executorAgentName}

执行 Agent (${executorAgentName}) 的最新回复：
${lastMessage.content}
`;

  // TODO: 使用 LLM 技能生成追问
  // const response = await llm.chat.completions.create({...});
  const response = await mockLLMCall(prompt, executorAgentName);

  return response;
}

/**
 * 分析执行 Agent 的回复，判断是否理解任务
 */
async function analyzeUnderstand(
  response: string,
  context: DialogueContext,
  executorAgentName: string
): Promise<{ isUnderstand: boolean; confidence: number }> {
  const prompt = `
任务信息：
- 任务标题：${context.taskTitle}
- 任务描述：${context.taskDescription}
- 执行 Agent: ${executorAgentName}

执行 Agent (${executorAgentName}) 的回复：
${response}
`;

  // TODO: 使用 LLM 技能分析理解状态
  // const llmResponse = await llm.chat.completions.create({...});

  try {
    const llmResponse = await mockLLMCall(prompt, executorAgentName);
    const result = JSON.parse(llmResponse);

    return {
      isUnderstand: result.isUnderstand || false,
      confidence: result.confidence || 0,
    };
  } catch (error) {
    console.error('[Agent B] 分析理解状态失败:', error);
    return { isUnderstand: false, confidence: 0 };
  }
}

/**
 * 获取执行 Agent 的回复
 * 注意：这是一个模拟函数，实际场景中需要调用执行 Agent 的接口
 */
async function getExecutorResponse(
  executorAgentId: string,
  executorAgentName: string,
  question: string,
  history: DialogueMessage[]
): Promise<string> {
  // TODO: 实际场景中，这里需要调用执行 Agent 的接口获取回复
  // 目前返回模拟回复

  const mockResponses = [
    `我是${executorAgentName}，我理解了这个任务，我现在就开始执行。`,
    `我是${executorAgentName}，任务要求是创作一篇关于保险的文章，对吧？`,
    `我是${executorAgentName}，我需要先查看一下相关的市场数据和案例。`,
    `我是${executorAgentName}，好的，我会按照要求完成这个任务。`,
    `我是${executorAgentName}，这个任务的交付物是什么？`,
  ];

  // 随机返回一个回复
  return mockResponses[Math.floor(Math.random() * mockResponses.length)];
}

/**
 * 记录交互记录到数据库
 */
async function recordInteraction(
  context: DialogueContext,
  sender: string,
  content: string,
  isUnderstand: boolean
): Promise<void> {
  const db = getDatabase();

  // 确定消息类型
  let messageType: string;
  if (sender === 'agent_b') {
    messageType = 'question';
  } else {
    messageType = isUnderstand ? 'answer' : 'question';
  }

  // 记录到 agent_interactions 表
  await db.insert(schema.agentInteractions).values({
    commandResultId: context.commandResultId,
    taskDescription: context.taskDescription,
    sessionId: context.sessionId,
    sender,
    receiver: sender === 'agent_b' ? context.executorAgentId : 'agent_b',
    messageType,
    content,
    roundNumber: await getNextRoundNumber(context.sessionId),
    isUnderstand,
    createdAt: new Date(),
  });
}

/**
 * 获取下一个轮次编号
 */
async function getNextRoundNumber(sessionId: string): Promise<number> {
  const db = getDatabase();

  const result = await db
    .select({ maxRound: schema.agentInteractions.roundNumber })
    .from(schema.agentInteractions)
    .where(eq(schema.agentInteractions.sessionId, sessionId))
    .orderBy(schema.agentInteractions.roundNumber)
    .limit(1);

  if (result.length === 0 || result[0].maxRound === null) {
    return 1;
  }

  return result[0].maxRound + 1;
}

/**
 * 更新对话状态
 */
async function updateDialogueStatus(
  context: DialogueContext,
  roundCount: number,
  isUnderstand: boolean,
  completedReason: DialogueResult['completedReason']
): Promise<void> {
  const db = getDatabase();

  // 更新 command_results 表
  await db
    .update(schema.dailyTask)
    .set({
      dialogueSessionId: context.sessionId,
      dialogueRounds: roundCount,
      dialogueStatus: isUnderstand ? 'completed' : 'timeout',
      lastDialogueAt: new Date(),
    })
    .where(eq(schema.dailyTask.id, context.commandResultId));

  // 如果是子任务，也更新 agent_sub_tasks 表
  await db
    .update(schema.agentSubTasks)
    .set({
      dialogueSessionId: context.sessionId,
      dialogueRounds: roundCount,
      dialogueStatus: isUnderstand ? 'completed' : 'timeout',
      lastDialogueAt: new Date(),
    })
    .where(eq(schema.agentSubTasks.commandResultId, context.commandResultId));
}
