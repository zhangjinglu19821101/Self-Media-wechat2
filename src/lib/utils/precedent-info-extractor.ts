/**
 * 🔥 前序信息提取工具
 * 
 * 封装从数据库中提取前序信息的工具方法，包括：
 * 1. 提取所有前序任务的结果集合
 * 2. 提取当前 MCP 的执行结果
 * 3. 提取当前的用户反馈内容
 * 4. 调用智能选择器选择最重要的信息
 * 
 * @design-principles
 * - 单一职责：每个方法只负责一种信息提取
 * - 类型安全：使用 TypeScript 类型定义
 * - 错误处理：提供完善的错误处理机制
 */

import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { agentSubTasksMcpExecutions } from '@/lib/db/schema/agent-sub-tasks-mcp-executions';
import { eq, and, desc, lt } from 'drizzle-orm';
import { callLLM } from '@/lib/agent-llm';
import { extractResultTextFromResultData as extractResultTextCore } from '@/lib/services/result-text-extractor';
import { loadAgentPrompt } from '@/lib/agents/prompt-loader';

/**
 * 前序任务结果
 */
export interface PreviousTaskResult {
  orderIndex: number;
  taskTitle: string;
  resultText: string;
  taskId: string;
}

/**
 * MCP 执行结果
 */
export interface McpExecutionResult {
  toolName?: string;
  actionName?: string;
  resultStatus: string;
  resultText?: string;
  resultData?: any;
  errorMessage?: string;
  attemptTimestamp?: Date;
}

/**
 * 用户反馈内容
 */
export interface UserFeedback {
  interactContent: any;
  interactTime: Date;
  interactNum: number;
}

/**
 * 智能选择器输入
 */
export interface SmartSelectorInput {
  previousTaskResults: PreviousTaskResult[];
  mcpExecutionResult: McpExecutionResult | null;
  userFeedbacks: UserFeedback[];
  currentTask: {
    taskTitle: string;
    taskDescription?: string;
    orderIndex: number;
  };
}

/**
 * 智能选择器输出
 */
export interface SmartSelectorOutput {
  selectedInfoText: string;
  selectorResponse: string;
  usedLLM: boolean;
}

/**
 * 前序信息提取工具
 */
export class PrecedentInfoExtractor {
  private static instance: PrecedentInfoExtractor;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): PrecedentInfoExtractor {
    if (!PrecedentInfoExtractor.instance) {
      PrecedentInfoExtractor.instance = new PrecedentInfoExtractor();
    }
    return PrecedentInfoExtractor.instance;
  }

  /**
   * 1️⃣ 根据 agent_sub_tasks 表中的 command_result_id、order_index
   * 从每条记录的 result_text 提取所有前序结果集合
   * 
   * @param commandResultId 命令结果 ID
   * @param currentOrderIndex 当前任务的 order_index
   * @returns 前序任务结果数组
   */
  public async extractPreviousTaskResults(
    commandResultId: string,
    currentOrderIndex: number
  ): Promise<PreviousTaskResult[]> {
    console.log('[PrecedentInfoExtractor] 提取前序任务结果:', {
      commandResultId,
      currentOrderIndex
    });

    try {
      // 查询所有 order_index < currentOrderIndex 的任务
      const previousTasks = await db
        .select({
          id: agentSubTasks.id,
          orderIndex: agentSubTasks.orderIndex,
          taskTitle: agentSubTasks.taskTitle,
          resultText: agentSubTasks.resultText,
          resultData: agentSubTasks.resultData,
          fromParentsExecutor: agentSubTasks.fromParentsExecutor,
        })
        .from(agentSubTasks)
        .where(
          and(
            eq(agentSubTasks.commandResultId, commandResultId as any),
            lt(agentSubTasks.orderIndex, currentOrderIndex)
          )
        )
        .orderBy(agentSubTasks.orderIndex);

      console.log('[PrecedentInfoExtractor] 查询到前序任务数:', previousTasks.length);

      // 处理结果，提取 resultText
      const results: PreviousTaskResult[] = [];
      for (const task of previousTasks) {
        let resultText = task.resultText || '';
        
        // 如果 resultText 为空，尝试从 resultData 中提取
        if (!resultText && task.resultData) {
          resultText = this.extractTextFromResultData(task.resultData, task.fromParentsExecutor);
        }

        results.push({
          orderIndex: task.orderIndex,
          taskTitle: task.taskTitle,
          resultText,
          taskId: task.id.toString(),
        });
      }

      console.log('[PrecedentInfoExtractor] 成功提取前序任务结果:', {
        count: results.length,
        hasContent: results.some(r => r.resultText.length > 0)
      });

      return results;

    } catch (error) {
      console.error('[PrecedentInfoExtractor] 提取前序任务结果失败:', error);
      throw new Error(`提取前序任务结果失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 2️⃣ 根据 agent_sub_tasks_mcp_executions 表中的 command_result_id、order_index
   * 从该记录中的 result_text 提取当前 MCP 的执行结果
   * 
   * @param commandResultId 命令结果 ID
   * @param orderIndex 任务的 order_index
   * @returns MCP 执行结果（取最新的一条）
   */
  public async extractMcpExecutionResult(
    commandResultId: string,
    orderIndex: number
  ): Promise<McpExecutionResult | null> {
    console.log('[PrecedentInfoExtractor] 提取 MCP 执行结果:', {
      commandResultId,
      orderIndex
    });

    try {
      // 查询最新的 MCP 执行记录
      const mcpResults = await db
        .select()
        .from(agentSubTasksMcpExecutions)
        .where(
          and(
            eq(agentSubTasksMcpExecutions.commandResultId, commandResultId),
            eq(agentSubTasksMcpExecutions.orderIndex, orderIndex)
          )
        )
        .orderBy(desc(agentSubTasksMcpExecutions.attemptTimestamp))
        .limit(1);

      if (mcpResults.length === 0) {
        console.log('[PrecedentInfoExtractor] 没有找到 MCP 执行记录');
        return null;
      }

      const mcpResult = mcpResults[0];
      
      const result: McpExecutionResult = {
        toolName: mcpResult.toolName,
        actionName: mcpResult.actionName,
        resultStatus: mcpResult.resultStatus,
        resultText: mcpResult.resultText,
        resultData: mcpResult.resultData,
        errorMessage: mcpResult.errorMessage,
        attemptTimestamp: mcpResult.attemptTimestamp,
      };

      console.log('[PrecedentInfoExtractor] 成功提取 MCP 执行结果:', {
        toolName: result.toolName,
        actionName: result.actionName,
        resultStatus: result.resultStatus,
        hasResultText: !!result.resultText,
        hasError: !!result.errorMessage,
      });

      return result;

    } catch (error) {
      console.error('[PrecedentInfoExtractor] 提取 MCP 执行结果失败:', error);
      throw new Error(`提取 MCP 执行结果失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 3️⃣ 根据 agent_sub_tasks_step_history 表中的 command_result_id、order_index、interactUser = 'human'
   * 找出当前的用户反馈内容
   * 
   * @param commandResultId 命令结果 ID
   * @param orderIndex 任务的 order_index
   * @returns 用户反馈内容数组（按时间倒序排列）
   */
  public async extractUserFeedbacks(
    commandResultId: string,
    orderIndex: number
  ): Promise<UserFeedback[]> {
    console.log('[PrecedentInfoExtractor] 提取用户反馈内容:', {
      commandResultId,
      orderIndex
    });

    try {
      // 查询所有 interactUser = 'human' 的记录
      const userFeedbacks = await db
        .select({
          interactContent: agentSubTasksStepHistory.interactContent,
          interactTime: agentSubTasksStepHistory.interactTime,
          interactNum: agentSubTasksStepHistory.interactNum,
          interactType: agentSubTasksStepHistory.interactType,
        })
        .from(agentSubTasksStepHistory)
        .where(
          and(
            eq(agentSubTasksStepHistory.commandResultId, commandResultId as any),
            eq(agentSubTasksStepHistory.stepNo, orderIndex),
            eq(agentSubTasksStepHistory.interactUser, 'human')
          )
        )
        .orderBy(desc(agentSubTasksStepHistory.interactTime));

      console.log('[PrecedentInfoExtractor] 查询到用户反馈数:', userFeedbacks.length);

      const results: UserFeedback[] = userFeedbacks.map(feedback => ({
        interactContent: feedback.interactContent,
        interactTime: feedback.interactTime,
        interactNum: feedback.interactNum,
      }));

      console.log('[PrecedentInfoExtractor] 成功提取用户反馈内容:', {
        count: results.length,
      });

      return results;

    } catch (error) {
      console.error('[PrecedentInfoExtractor] 提取用户反馈内容失败:', error);
      throw new Error(`提取用户反馈内容失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 4️⃣ 根据上述的 1、2、3，调用智能选择器，选择出最重要的信息
   * 
   * @param input 智能选择器输入
   * @param executorAgentId 执行 Agent ID（用于加载提示词）
   * @returns 智能选择器输出
   */
  public async selectImportantInfoWithLLM(
    input: SmartSelectorInput,
    executorAgentId: string
  ): Promise<SmartSelectorOutput> {
    console.log('[PrecedentInfoExtractor] 调用智能选择器选择最重要的信息:', {
      executorAgentId,
      previousTaskCount: input.previousTaskResults.length,
      hasMcpResult: !!input.mcpExecutionResult,
      userFeedbackCount: input.userFeedbacks.length,
    });

    try {
      // 构建提示词
      const prompt = this.buildSmartSelectorPrompt(input);

      // 加载 Agent 提示词
      const agentPrompt = loadAgentPrompt(executorAgentId);

      // 调用 LLM
      const selectorResponse = await callLLM(
        executorAgentId,
        '前序信息智能选择',
        agentPrompt,
        prompt,
        {
          timeout: 180000 // 3 分钟超时
        }
      );

      console.log('[PrecedentInfoExtractor] 智能选择器响应成功');

      // 解析响应并提取信息
      const selectedInfoText = this.parseSelectorResponse(selectorResponse, input);

      return {
        selectedInfoText,
        selectorResponse,
        usedLLM: true,
      };

    } catch (error) {
      console.error('[PrecedentInfoExtractor] 智能选择器调用失败，使用降级方案:', error);
      
      // 降级方案：直接返回所有信息的拼接
      const fallbackText = this.buildFallbackInfoText(input);
      
      return {
        selectedInfoText: fallbackText,
        selectorResponse: '',
        usedLLM: false,
      };
    }
  }

  /**
   * 从 resultData 中提取文本
   * 🔥🔥🔥 委托给共享服务 extractResultTextCore（平台配置驱动 + 动态发现兜底）
   * 不再维护独立的提取逻辑
   */
  private extractTextFromResultData(resultData: any, executor?: string): string {
    return extractResultTextCore(resultData, { executor });
  }

  /**
   * 构建智能选择器提示词
   */
  private buildSmartSelectorPrompt(input: SmartSelectorInput): string {
    let prompt = '';

    // 1. 当前任务信息
    prompt += '【当前任务】\n';
    prompt += `任务标题：${input.currentTask.taskTitle}\n`;
    if (input.currentTask.taskDescription) {
      prompt += `任务描述：${input.currentTask.taskDescription}\n`;
    }
    prompt += `任务序号：${input.currentTask.orderIndex}\n\n`;

    // 2. 当前 MCP 执行结果
    if (input.mcpExecutionResult) {
      prompt += '【当前 MCP 执行结果】\n';
      prompt += `• 工具：${input.mcpExecutionResult.toolName || '-'}.${input.mcpExecutionResult.actionName || '-'}\n`;
      prompt += `• 状态：${input.mcpExecutionResult.resultStatus}\n`;
      if (input.mcpExecutionResult.resultText) {
        prompt += `• 结果文本：${input.mcpExecutionResult.resultText}\n`;
      }
      if (input.mcpExecutionResult.errorMessage) {
        prompt += `• 错误信息：${input.mcpExecutionResult.errorMessage}\n`;
      }
      prompt += '\n';
    }

    // 3. 用户反馈内容
    if (input.userFeedbacks.length > 0) {
      prompt += '【用户反馈内容】\n';
      input.userFeedbacks.forEach((feedback, index) => {
        prompt += `• 反馈 ${index + 1}（时间：${feedback.interactTime.toISOString()}）：\n`;
        prompt += `  ${JSON.stringify(feedback.interactContent, null, 2)}\n`;
      });
      prompt += '\n';
    }

    // 4. 前序任务结果
    if (input.previousTaskResults.length > 0) {
      prompt += '【前序任务结果】\n';
      input.previousTaskResults.forEach(task => {
        prompt += `• 步骤 ${task.orderIndex}：${task.taskTitle}\n`;
        if (task.resultText) {
          const preview = task.resultText.length > 500 
            ? task.resultText.substring(0, 500) + '...' 
            : task.resultText;
          prompt += `  ${preview}\n`;
        }
        prompt += '\n';
      });
    }

    // 5. 选择说明
    prompt += `
【智能选择说明】
请根据当前任务的需要，从上述信息中选择最重要、最相关的内容。

选择原则：
1. 优先选择与当前任务直接相关的信息
2. 保留 MCP 执行结果的关键信息
3. 保留用户反馈的核心内容
4. 从前序任务中选择最相关的结果

请按以下 JSON 格式返回你的选择：
{
  "status": "completed",
  "result": {
    "selectedMcpResult": "是否选择 MCP 结果（true/false）",
    "selectedUserFeedbacks": [
      {
        "index": 0,
        "reason": "为什么选择这个用户反馈"
      }
    ],
    "selectedPreviousTasks": [
      {
        "orderIndex": 1,
        "reason": "为什么选择这个前序任务"
      }
    ],
    "summary": "对选择内容的总结"
  },
  "message": "选择说明",
  "confidence": 90,
  "timestamp": "${new Date().toISOString()}",
  "agentVersion": "1.0.0"
}`;

    return prompt;
  }

  /**
   * 解析选择器响应
   */
  private parseSelectorResponse(selectorResponse: string, input: SmartSelectorInput): string {
    try {
      // 尝试解析 JSON
      const jsonMatch = selectorResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[PrecedentInfoExtractor] 无法从响应中提取 JSON，使用降级方案');
        return this.buildFallbackInfoText(input);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // 构建选中的信息文本
      let selectedText = '';

      // 当前任务信息
      selectedText += '【当前任务】\n';
      selectedText += `任务标题：${input.currentTask.taskTitle}\n`;
      if (input.currentTask.taskDescription) {
        selectedText += `任务描述：${input.currentTask.taskDescription}\n`;
      }
      selectedText += '\n';

      // MCP 执行结果
      if (parsed.result?.selectedMcpResult && input.mcpExecutionResult) {
        selectedText += '【当前 MCP 执行结果】\n';
        selectedText += `• 工具：${input.mcpExecutionResult.toolName || '-'}.${input.mcpExecutionResult.actionName || '-'}\n`;
        selectedText += `• 状态：${input.mcpExecutionResult.resultStatus}\n`;
        if (input.mcpExecutionResult.resultText) {
          selectedText += `• 结果：${input.mcpExecutionResult.resultText}\n`;
        }
        if (input.mcpExecutionResult.errorMessage) {
          selectedText += `• 错误：${input.mcpExecutionResult.errorMessage}\n`;
        }
        selectedText += '\n';
      }

      // 用户反馈
      if (parsed.result?.selectedUserFeedbacks && parsed.result.selectedUserFeedbacks.length > 0) {
        selectedText += '【用户反馈内容】\n';
        for (const selected of parsed.result.selectedUserFeedbacks) {
          const feedback = input.userFeedbacks[selected.index];
          if (feedback) {
            selectedText += `• ${JSON.stringify(feedback.interactContent)}\n`;
          }
        }
        selectedText += '\n';
      }

      // 前序任务
      if (parsed.result?.selectedPreviousTasks && parsed.result.selectedPreviousTasks.length > 0) {
        selectedText += '【前序任务结果】\n';
        for (const selected of parsed.result.selectedPreviousTasks) {
          const task = input.previousTaskResults.find(t => t.orderIndex === selected.orderIndex);
          if (task) {
            selectedText += `• 步骤 ${task.orderIndex}：${task.taskTitle}\n`;
            if (task.resultText) {
              selectedText += `  ${task.resultText}\n`;
            }
            selectedText += '\n';
          }
        }
      }

      // 总结
      if (parsed.result?.summary) {
        selectedText += '【内容总结】\n';
        selectedText += parsed.result.summary + '\n';
      }

      return selectedText || this.buildFallbackInfoText(input);

    } catch (error) {
      console.warn('[PrecedentInfoExtractor] 解析选择器响应失败，使用降级方案:', error);
      return this.buildFallbackInfoText(input);
    }
  }

  /**
   * 构建降级方案的信息文本
   */
  private buildFallbackInfoText(input: SmartSelectorInput): string {
    let text = '';

    // 当前任务信息
    text += '【当前任务】\n';
    text += `任务标题：${input.currentTask.taskTitle}\n`;
    if (input.currentTask.taskDescription) {
      text += `任务描述：${input.currentTask.taskDescription}\n`;
    }
    text += '\n';

    // MCP 执行结果
    if (input.mcpExecutionResult) {
      text += '【当前 MCP 执行结果】\n';
      text += `• 工具：${input.mcpExecutionResult.toolName || '-'}.${input.mcpExecutionResult.actionName || '-'}\n`;
      text += `• 状态：${input.mcpExecutionResult.resultStatus}\n`;
      if (input.mcpExecutionResult.resultText) {
        text += `• 结果：${input.mcpExecutionResult.resultText}\n`;
      }
      if (input.mcpExecutionResult.errorMessage) {
        text += `• 错误：${input.mcpExecutionResult.errorMessage}\n`;
      }
      text += '\n';
    }

    // 用户反馈内容
    if (input.userFeedbacks.length > 0) {
      text += '【用户反馈内容】\n';
      input.userFeedbacks.forEach((feedback, index) => {
        text += `• 反馈 ${index + 1}：${JSON.stringify(feedback.interactContent)}\n`;
      });
      text += '\n';
    }

    // 前序任务结果
    if (input.previousTaskResults.length > 0) {
      text += '【前序任务结果】\n';
      input.previousTaskResults.forEach(task => {
        text += `• 步骤 ${task.orderIndex}：${task.taskTitle}\n`;
        if (task.resultText) {
          const preview = task.resultText.length > 300 
            ? task.resultText.substring(0, 300) + '...' 
            : task.resultText;
          text += `  ${preview}\n`;
        }
        text += '\n';
      });
    }

    return text;
  }

  /**
   * 🔴 新增：一键提取并格式化当前任务的历史信息（组合方法）
   * 
   * 按照业务规则：
   * 1. 用户反馈：只取当前 order_index + 当前 command_result_id，最新 1 条，100% 保留
   * 2. MCP 执行历史：只取当前 order_index + 当前 command_result_id，最新 1 条
   * 3. 前序任务信息：来自 step_history 的前序任务
   * 
   * @param task 当前任务对象
   * @returns 格式化好的历史信息文本
   */
  public async extractAndFormatCurrentTaskHistory(
    task: {
      id: string;
      commandResultId: string;
      orderIndex: number;
      taskTitle: string;
      taskDescription?: string;
    }
  ): Promise<string> {
    console.log('[PrecedentInfoExtractor] 提取并格式化当前任务历史:', {
      taskId: task.id,
      commandResultId: task.commandResultId,
      orderIndex: task.orderIndex,
      taskTitle: task.taskTitle
    });

    try {
      // 1. 提取前序任务结果
      const previousTaskResults = await this.extractPreviousTaskResults(
        task.commandResultId,
        task.orderIndex
      );

      // 2. 提取 MCP 执行结果（当前 order_index，最新 1 条）
      const mcpExecutionResult = await this.extractMcpExecutionResult(
        task.commandResultId,
        task.orderIndex
      );

      // 3. 提取用户反馈（当前 order_index，interactUser='human'）
      const userFeedbacks = await this.extractUserFeedbacks(
        task.commandResultId,
        task.orderIndex
      );

      // 4. 构建最终的格式化文本
      const finalText = this.buildFinalHistoryText(
        previousTaskResults,
        mcpExecutionResult,
        userFeedbacks,
        task
      );

      console.log('[PrecedentInfoExtractor] 当前任务历史提取并格式化完成:', {
        hasPreviousTasks: previousTaskResults.length > 0,
        hasMcpResult: !!mcpExecutionResult,
        hasUserFeedbacks: userFeedbacks.length > 0,
        finalTextLength: finalText.length
      });

      return finalText;

    } catch (error) {
      console.error('[PrecedentInfoExtractor] ❌ 提取当前任务历史失败:', error);
      // 失败时返回空字符串，不阻塞主流程
      return '';
    }
  }

  /**
   * 🔴 新增：构建最终的历史信息文本
   */
  private buildFinalHistoryText(
    previousTaskResults: PreviousTaskResult[],
    mcpExecutionResult: McpExecutionResult | null,
    userFeedbacks: UserFeedback[],
    currentTask: {
      taskTitle: string;
      taskDescription?: string;
    }
  ): string {
    const parts: string[] = [];

    // 开头说明
    parts.push('【当前任务执行历史】');
    parts.push('说明：这不是首次执行，下面是之前的执行记录，请参考这些信息继续完成任务。');
    parts.push('');

    // 🔴 第一优先级：用户反馈（最新 1 条，完整保留）
    if (userFeedbacks.length > 0) {
      const latestFeedback = userFeedbacks[0]; // 已经是倒序排列，第一个就是最新的
      
      parts.push('🔴 🔴 🔴 【用户反馈 - 最高优先级！请务必重视！】 🔴 🔴 🔴');
      parts.push('');
      
      const time = latestFeedback.interactTime ? new Date(latestFeedback.interactTime).toLocaleString() : '未知时间';
      parts.push(`[${time}] 用户反馈:`);
      
      try {
        const content = typeof latestFeedback.interactContent === 'string' 
          ? latestFeedback.interactContent 
          : JSON.stringify(latestFeedback.interactContent);
        parts.push(`   ${content}`);
      } catch (e) {
        parts.push('   [无法解析的内容]');
      }
      
      parts.push('');
      parts.push('【重要提示】');
      parts.push('- 用户的反馈是最高优先级的决策依据');
      parts.push('- 请务必认真对待用户的反馈和要求');
      parts.push('- 根据用户反馈调整执行方向');
      parts.push('');
    }

    // 🟡 第二优先级：前序任务信息
    if (previousTaskResults.length > 0) {
      parts.push('【前序任务信息】');
      previousTaskResults.forEach((task, index) => {
        parts.push(`${index + 1}. 步骤 ${task.orderIndex}：${task.taskTitle}`);
        if (task.resultText) {
          const preview = task.resultText.length > 200 
            ? task.resultText.substring(0, 200) + '...' 
            : task.resultText;
          parts.push(`   ${preview}`);
        }
      });
      parts.push('');
    }

    // 🟡 第三优先级：MCP 执行历史（最新 1 条）
    if (mcpExecutionResult) {
      parts.push('【MCP 工具调用历史】');
      
      const time = mcpExecutionResult.attemptTimestamp 
        ? new Date(mcpExecutionResult.attemptTimestamp).toLocaleString() 
        : '未知时间';
      
      parts.push(`1. [${time}] ${mcpExecutionResult.toolName || mcpExecutionResult.actionName || '未知工具'}`);
      parts.push(`   状态: ${mcpExecutionResult.resultStatus || '未知状态'}`);
      
      if (mcpExecutionResult.resultText) {
        parts.push(`   结果文本: ${mcpExecutionResult.resultText}`);
      }
      
      if (mcpExecutionResult.resultStatus === 'success' && mcpExecutionResult.resultData) {
        try {
          const resultStr = typeof mcpExecutionResult.resultData === 'string' 
            ? mcpExecutionResult.resultData 
            : JSON.stringify(mcpExecutionResult.resultData);
          parts.push(`   结果数据: ${resultStr.substring(0, 300)}${resultStr.length > 300 ? '...' : ''}`);
        } catch (e) {
          parts.push('   结果数据: [无法解析]');
        }
      }
      
      if (mcpExecutionResult.errorMessage) {
        parts.push(`   错误: ${mcpExecutionResult.errorMessage}`);
      }
      
      parts.push('');
    }

    return parts.join('\n');
  }
}

/**
 * 默认导出单例实例
 */
export default PrecedentInfoExtractor.getInstance();
