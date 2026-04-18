/**
 * Agent B 对话总结功能
 * 总结对话内容，生成总结信息、结论和建议行动
 */

import { DialogueMessage, DialogueResult, getAgentName } from './judge-executor-response';
import { getLLMClient, callLLM } from '@/lib/agent-llm';

// === 真实 LLM 调用 ===
async function realLLMCall(prompt: string, executorAgentName: string, agentId: string = 'agent-b'): Promise<string> {
  console.log(`[Agent B] 调用真实 LLM 进行对话总结，Agent ID: ${agentId}`);
  
  const systemPrompt = `你是 Agent B，负责总结与执行 Agent 的对话内容，生成总结、结论和建议行动。

你的职责：
1. 总结对话内容
2. 得出明确的结论
3. 提出具体的建议行动

执行 Agent: ${executorAgentName}
`;

  try {
    const response = await callLLM(
      agentId,
      `总结与执行 Agent ${executorAgentName} 的对话`,
      systemPrompt,
      prompt
    );
    return response;
  } catch (error) {
    console.error('[Agent B] LLM 调用失败:', error);
    throw error;
  }
}

// === 类型定义 ===

export interface DialogueSummary {
  sessionId: string;
  summary: string; // 总结信息
  conclusion: string; // 结论
  suggestedActions: SuggestedAction[]; // 建议的后续行动
  dialogueProcess: DialogueProcessEntry[]; // 对话过程信息
}

export interface SuggestedAction {
  action: string; // 'reassign_task' | 'adjust_resources' | 'escalate' | 'dismiss'
  description: string;
  targetAgentId?: string;
  resources?: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface DialogueProcessEntry {
  round: number;
  sender: string; // 发送方名称（如 "Agent B"、"保险运营（insurance-c）"）
  senderId: string; // 发送方 ID（如 "agent_b"、"executor"）
  content: string;
  isUnderstand: boolean;
  timestamp: string;
}

// === 对话总结函数 ===

/**
 * 总结对话内容
 * @param dialogueResult 对话结果
 * @returns 对话总结
 */
export async function summarizeDialogue(dialogueResult: DialogueResult): Promise<DialogueSummary> {
  const executorAgentName = getAgentName(dialogueResult.executorAgentId);
  console.log(`[Agent B] 开始总结对话...`);
  console.log(`[Agent B] 会话 ID: ${dialogueResult.sessionId}`);
  console.log(`[Agent B] 对话轮数: ${dialogueResult.roundCount}`);
  console.log(`[Agent B] 执行 Agent: ${executorAgentName} (ID: ${dialogueResult.executorAgentId})`);

  try {
    // === 步骤 1：转换对话格式 ===
    const dialogueProcess = convertToDialogueProcess(dialogueResult.messages, executorAgentName);

    // === 步骤 2：生成总结 ===
    const summary = await generateSummary(dialogueResult, executorAgentName);

    // === 步骤 3：生成结论 ===
    const conclusion = await generateConclusion(dialogueResult, summary, executorAgentName);

    // === 步骤 4：生成建议行动 ===
    const suggestedActions = await generateSuggestedActions(dialogueResult, summary, conclusion, executorAgentName);

    // === 步骤 5：返回总结 ===
    const result: DialogueSummary = {
      sessionId: dialogueResult.sessionId,
      summary,
      conclusion,
      suggestedActions,
      dialogueProcess,
    };

    console.log(`[Agent B] 对话总结完成`);
    console.log(`[Agent B] 结论: ${conclusion}`);

    return result;
  } catch (error) {
    console.error('[Agent B] 对话总结失败:', error);
    throw error;
  }
}

/**
 * 转换对话格式
 */
function convertToDialogueProcess(messages: DialogueMessage[], executorAgentName: string): DialogueProcessEntry[] {
  return messages.map((msg, index) => ({
    round: index + 1,
    sender: msg.role === 'agent_b' ? 'Agent B' : executorAgentName,
    senderId: msg.role === 'agent_b' ? 'agent_b' : 'executor',
    content: msg.content,
    isUnderstand: msg.isUnderstand,
    timestamp: msg.timestamp.toISOString(),
  }));
}

/**
 * 生成总结
 */
async function generateSummary(dialogueResult: DialogueResult, executorAgentName: string): Promise<string> {
  const prompt = `
对话信息：
- 会话 ID: ${dialogueResult.sessionId}
- 对话轮数: ${dialogueResult.roundCount}
- 完成原因: ${dialogueResult.completedReason}
- 执行 Agent: ${executorAgentName} (ID: ${dialogueResult.executorAgentId})
- 执行 Agent 是否理解: ${dialogueResult.isUnderstand ? '是' : '否'}

对话历史：
${dialogueResult.messages.map(msg => `${msg.role === 'agent_b' ? 'Agent B' : executorAgentName}: ${msg.content}`).join('\n')}
`;

  const response = await realLLMCall(prompt, executorAgentName);

  return response || '对话总结生成失败';
}

/**
 * 生成结论
 */
async function generateConclusion(
  dialogueResult: DialogueResult,
  summary: string,
  executorAgentName: string
): Promise<string> {
  const prompt = `
对话总结：
${summary}

执行 Agent (${executorAgentName}) 是否理解任务：${dialogueResult.isUnderstand ? '是' : '否'}
`;

  // TODO: 使用 LLM 技能生成结论
  // const response = await llm.chat.completions.create({...});
  const response = await mockLLMCall(prompt, executorAgentName);

  return response || '结论生成失败';
}

/**
 * 生成建议行动
 */
async function generateSuggestedActions(
  dialogueResult: DialogueResult,
  summary: string,
  conclusion: string,
  executorAgentName: string
): Promise<SuggestedAction[]> {
  const prompt = `
对话总结：
${summary}

结论：
${conclusion}

执行 Agent (${executorAgentName}) 是否理解任务：${dialogueResult.isUnderstand ? '是' : '否'}
`;

  // TODO: 使用 LLM 技能生成建议行动
  // const response = await llm.chat.completions.create({...});

  try {
    const response = await mockLLMCall(prompt, executorAgentName);
    const actions = JSON.parse(response);

    // 验证并格式化行动
    return actions.map((action: any) => ({
      action: action.action || 'escalate',
      description: action.description || '未提供描述',
      targetAgentId: action.targetAgentId,
      resources: action.resources || [],
      priority: action.priority || 'medium',
    }));
  } catch (error) {
    console.error('[Agent B] 生成建议行动失败:', error);

    // 返回默认行动
    return [
      {
        action: 'escalate',
        description: `需要 Agent A 介入，帮助 ${executorAgentName} 理解任务`,
        priority: 'high',
      },
    ];
  }
}
