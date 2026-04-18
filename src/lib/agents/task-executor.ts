/**
 * Agent 任务执行器
 * 负责让对应的 Agent 执行子任务
 */

import { db } from '@/lib/db';
import { agentSubTasks, agentInteractions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { loadAgentPrompt, hasAgentPrompt, getLLMClient } from '@/lib/agent-llm';

/**
 * 执行子任务
 * @param subTaskId 子任务 ID
 * @returns 执行结果
 */
export async function executeSubTask(subTaskId: string): Promise<{
  success: boolean;
  result?: any;
  error?: string;
}> {
  console.log(`🚀 开始执行子任务: ${subTaskId}`);
  console.log(`🔍 subTaskId 类型: ${typeof subTaskId}, 长度: ${subTaskId?.length}`);

  try {
    // 1. 查询子任务信息
    console.log(`📊 正在查询子任务...`);
    const subTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, subTaskId));

    console.log(`📊 查询结果: 找到 ${subTasks.length} 条记录`);

    if (subTasks.length === 0) {
      console.error(`❌ 子任务 ${subTaskId} 不存在`);
      throw new Error(`子任务 ${subTaskId} 不存在`);
    }

    const subTask = subTasks[0];
    console.log(`📋 任务标题: ${subTask.taskTitle}`);
    console.log(`🤖 执行者: ${subTask.agentId}`);

    // 2. 检查子任务状态
    if (subTask.status !== 'in_progress') {
      throw new Error(`子任务状态不是 in_progress，当前状态: ${subTask.status}`);
    }

    // 3. 加载 Agent 身份提示词
    let agentPrompt = '';
    if (hasAgentPrompt(subTask.agentId)) {
      agentPrompt = loadAgentPrompt(subTask.agentId);
      console.log(`✅ 已加载 Agent ${subTask.agentId} 的身份提示词`);
    } else {
      console.warn(`⚠️ 未找到 Agent ${subTask.agentId} 的提示词文件`);
      agentPrompt = `你是 ${subTask.agentId}，请执行这个任务。`;
    }

    // 4. 构造执行提示词
    const executionPrompt = buildExecutionPrompt(agentPrompt, subTask);
    console.log(`📝 提示词长度: ${executionPrompt.length} 字符`);

    // 5. 调用 LLM
    console.log(`🤖 调用 LLM 执行任务...`);
    const llm = getLLMClient();
    const response = await llm.invoke([
      { role: 'system', content: executionPrompt }
    ], {
      temperature: 0.7,
    });

    console.log(`✅ LLM 响应成功`);

    // 6. 解析结果
    const result = parseLLMResponse(response.content);

    // 7. 记录执行结果
    await recordExecutionResult(subTaskId, result);

    console.log(`✅ 子任务执行完成`);

    return {
      success: true,
      result,
    };
  } catch (error) {
    console.error(`❌ 子任务执行失败:`, error);

    // 记录执行失败
    await recordExecutionFailure(subTaskId, error instanceof Error ? error.message : String(error));

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 构造执行提示词
 */
function buildExecutionPrompt(agentPrompt: string, subTask: any): string {
  const taskDescription = subTask.taskDescription || '无描述';
  const acceptanceCriteria = subTask.metadata?.acceptanceCriteria || '无';
  const isCritical = subTask.metadata?.isCritical || false;
  const criticalReason = subTask.metadata?.criticalReason || '';
  const deadline = subTask.metadata?.deadline || '无';
  const estimatedHours = subTask.metadata?.estimatedHours || '无';
  const priority = subTask.metadata?.priority || '中';
  const taskType = subTask.metadata?.taskType || '通用';

  return `
# ${agentPrompt}

---

## 当前需要执行的任务

### 任务信息
- 📋 任务标题：${subTask.taskTitle}
- 📝 任务描述：${taskDescription}
- 🔢 执行顺序：${subTask.orderIndex}

### 验收标准
${acceptanceCriteria}

### 任务属性
- 🔥 是否关键：${isCritical ? '✅ 是' : '❌ 否'}
${criticalReason ? `关键原因：${criticalReason}` : ''}
- 📅 截止时间：${deadline}
- ⏱️ 预估耗时：${estimatedHours}
- ⚡ 优先级：${priority}
- 📊 任务类型：${taskType}

---

## 你的任务

请基于你的身份和能力边界，执行这个任务。

注意：
1. 严格遵守你的业务边界和能力范围
2. 确保满足验收标准
3. 如果这是关键任务，请务必保证质量
4. 如果遇到问题，请详细说明

---

## 返回格式

请严格按照以下 JSON 格式返回：

\`\`\`json
{
  "success": true/false,
  "result": {
    "output": "你的执行结果（文本、内容、链接等）",
    "deliverables": ["交付物列表"],
    "notes": "执行过程中的备注或说明"
  },
  "issues": ["遇到的问题列表（如果有）"],
  "nextSteps": ["后续建议（如果有）"]
}
\`\`\`
`;
}

/**
 * 解析 LLM 响应
 */
function parseLLMResponse(content: string): any {
  try {
    // 尝试提取 JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // 如果没有 JSON，返回原始内容
    return {
      success: true,
      result: {
        output: content,
        deliverables: [],
        notes: '非结构化返回',
      },
      issues: [],
      nextSteps: [],
    };
  } catch (error) {
    console.error(`❌ 解析 LLM 响应失败:`, error);

    // 解析失败，返回原始内容
    return {
      success: true,
      result: {
        output: content,
        deliverables: [],
        notes: '解析失败，返回原始内容',
      },
      issues: ['响应解析失败'],
      nextSteps: [],
    };
  }
}

/**
 * 记录执行结果
 */
async function recordExecutionResult(subTaskId: string, result: any): Promise<void> {
  console.log(`📝 记录执行结果: subTaskId = ${subTaskId}`);

  // 更新子任务状态为 completed
  const updateResult = await db
    .update(agentSubTasks)
    .set({
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
      executionResult: JSON.stringify(result),
    })
    .where(eq(agentSubTasks.id, subTaskId));

  console.log(`✅ 子任务更新成功: ${updateResult.rowCount} 行受影响`);

  // 查询子任务信息，用于记录交互
  const subTasks = await db
    .select()
    .from(agentSubTasks)
    .where(eq(agentSubTasks.id, subTaskId));

  if (subTasks.length > 0) {
    const subTask = subTasks[0];

    // 记录到 agent_interactions
    await db.insert(agentInteractions).values({
      commandResultId: subTask.commandResultId,
      taskDescription: subTask.taskTitle,
      sessionId: `exec-${subTaskId}`,
      sender: subTask.agentId,
      receiver: 'system',
      messageType: 'answer',
      content: JSON.stringify(result.result?.output || result),
      roundNumber: 1,
      isResolution: result.success || false,
      metadata: {
        trigger: 'task_execution',
        result: result,
      },
    });
  }
}

/**
 * 记录执行失败
 */
async function recordExecutionFailure(subTaskId: string, errorMessage: string): Promise<void> {
  console.log(`❌ 记录执行失败: subTaskId = ${subTaskId}, error = ${errorMessage}`);

  // 更新子任务状态为 failed
  const updateResult = await db
    .update(agentSubTasks)
    .set({
      status: 'failed',
      completedAt: new Date(),
      updatedAt: new Date(),
      statusProof: errorMessage,
    })
    .where(eq(agentSubTasks.id, subTaskId));

  console.log(`✅ 子任务更新为失败: ${updateResult.rowCount} 行受影响`);

  // 查询子任务信息，用于记录交互
  const subTasks = await db
    .select()
    .from(agentSubTasks)
    .where(eq(agentSubTasks.id, subTaskId));

  if (subTasks.length > 0) {
    const subTask = subTasks[0];

    // 记录到 agent_interactions
    await db.insert(agentInteractions).values({
      commandResultId: subTask.commandResultId,
      taskDescription: subTask.taskTitle,
      sessionId: `exec-${subTaskId}`,
      sender: subTask.agentId,
      receiver: 'system',
      messageType: 'question',
      content: `执行失败：${errorMessage}`,
      roundNumber: 1,
      isResolution: false,
      metadata: {
        trigger: 'task_execution',
        error: errorMessage,
      },
    });
  }
}
