/**
 * 🔥 前序信息获取服务
 * 
 * 统一封装前序信息获取和筛选逻辑，供 callExecutorAgentDirectly 和 executeExecutorAgentWorkflow 使用
 * 
 * @design-principles
 * - 单一职责：只负责前序信息获取
 * - 策略模式：支持不同筛选策略
 * - 降级机制：LLM 筛选失败时自动降级
 * - 统一接口：两个方法使用相同服务
 */

import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { agentSubTasksMcpExecutions } from '@/lib/db/schema/agent-sub-tasks-mcp-executions';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';
import { loadAgentPrompt, loadFeaturePrompt } from '@/lib/agents/prompt-loader';
import { callLLM } from '@/lib/agent-llm';
import { extractResultTextFromResultData as extractResultTextCore } from '@/lib/services/result-text-extractor';

/**
 * 筛选策略类型
 */
export type PrecedentFilterStrategy = 
  | 'all'           // 返回所有前序任务（不筛选）
  | 'llm'           // LLM 智能筛选
  | 'recent'        // 只返回最近的 N 个任务
  | 'llm-with-fallback'; // LLM 筛选，失败时降级到 all

/**
 * 前序信息获取选项
 */
export interface PrecedentInfoOptions {
  strategy: PrecedentFilterStrategy;
  maxRecentTasks?: number; // 仅用于 'recent' 策略
  enableFallback?: boolean; // 是否启用降级
}

/**
 * 前序信息获取结果
 */
export interface PrecedentInfoResult {
  infoText: string;
  strategyUsed: PrecedentFilterStrategy;
  usedLLMFilter: boolean;
  llmResponse?: string;
  taskCount: number;
  filteredTaskCount: number;
}

/**
 * 前序信息获取服务
 * 
 * @example
 * ```typescript
 * const fetcher = PrecedentInfoFetcher.getInstance();
 * const result = await fetcher.fetchPrecedentInfo(task, allTasksInGroup, {
 *   strategy: 'llm-with-fallback',
 *   enableFallback: true
 * });
 * ```
 */
export class PrecedentInfoFetcher {
  private static instance: PrecedentInfoFetcher;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): PrecedentInfoFetcher {
    if (!PrecedentInfoFetcher.instance) {
      PrecedentInfoFetcher.instance = new PrecedentInfoFetcher();
    }
    return PrecedentInfoFetcher.instance;
  }

  /**
   * 🔥 获取前序信息（统一入口）
   * 
   * @param task 当前任务
   * @param allTasksInGroup 同组所有任务
   * @param options 筛选选项
   * @returns 前序信息结果
   */
  public async fetchPrecedentInfo(
    task: typeof agentSubTasks.$inferSelect,
    allTasksInGroup: Array<typeof agentSubTasks.$inferSelect>,
    options: PrecedentInfoOptions = { strategy: 'llm-with-fallback', enableFallback: true }
  ): Promise<PrecedentInfoResult> {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║          [前序信息获取服务] 开始获取                        ║');
    console.log('║                     任务ID: ' + task.id + '                             ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');

    const startTime = getCurrentBeijingTime();

    try {
      // 1. 获取所有前置任务
      const previousTasks = allTasksInGroup
        .filter(t => t.orderIndex < task.orderIndex)
        .sort((a, b) => b.orderIndex - a.orderIndex);

      console.log('[前序信息获取] 找到前置任务:', {
        total: previousTasks.length,
        strategy: options.strategy
      });

      if (previousTasks.length === 0) {
        console.log('[前序信息获取] 没有前置任务');
        return {
          infoText: '',
          strategyUsed: options.strategy,
          usedLLMFilter: false,
          taskCount: 0,
          filteredTaskCount: 0
        };
      }

      // 2. 根据策略选择筛选方式
      let result: PrecedentInfoResult;

      switch (options.strategy) {
        case 'all':
          result = await this.fetchAllTasks(previousTasks, task);
          break;

        case 'recent':
          result = await this.fetchRecentTasks(previousTasks, task, options.maxRecentTasks || 3);
          break;

        case 'llm':
          result = await this.fetchWithLLMFilter(previousTasks, task, allTasksInGroup);
          break;

        case 'llm-with-fallback':
        default:
          result = await this.fetchWithLLMFilterAndFallback(previousTasks, task, allTasksInGroup, options.enableFallback);
          break;
      }

      const endTime = getCurrentBeijingTime();
      console.log('[前序信息获取] 获取完成:', {
        duration_ms: endTime.getTime() - startTime.getTime(),
        strategy_used: result.strategyUsed,
        used_llm: result.usedLLMFilter,
        task_count: result.taskCount,
        filtered_count: result.filteredTaskCount,
        result_length: result.infoText.length
      });

      console.log('╔═══════════════════════════════════════════════════════════╗');
      console.log('║          [前序信息获取服务] 获取成功                        ║');
      console.log('╚═══════════════════════════════════════════════════════════╝');
      console.log('');

      return result;

    } catch (error) {
      console.error('[前序信息获取] 获取失败:', error);
      
      // 兜底：返回所有任务
      console.warn('[前序信息获取] 降级到 all 策略');
      return await this.fetchAllTasks(
        allTasksInGroup.filter(t => t.orderIndex < task.orderIndex),
        task
      );
    }
  }

  /**
   * 策略1：返回所有前序任务（不筛选）
   */
  private async fetchAllTasks(
    previousTasks: Array<typeof agentSubTasks.$inferSelect>,
    currentTask: typeof agentSubTasks.$inferSelect
  ): Promise<PrecedentInfoResult> {
    console.log('[前序信息获取] 使用策略: all（返回所有任务）');
    
    const infoText = await this.generateCuratedListFormat(previousTasks, currentTask);
    
    return {
      infoText,
      strategyUsed: 'all',
      usedLLMFilter: false,
      taskCount: previousTasks.length,
      filteredTaskCount: previousTasks.length
    };
  }

  /**
   * 策略2：只返回最近的 N 个任务
   */
  private async fetchRecentTasks(
    previousTasks: Array<typeof agentSubTasks.$inferSelect>,
    currentTask: typeof agentSubTasks.$inferSelect,
    maxTasks: number
  ): Promise<PrecedentInfoResult> {
    console.log('[前序信息获取] 使用策略: recent（最近' + maxTasks + '个任务）');
    
    const recentTasks = previousTasks.slice(0, maxTasks);
    const infoText = await this.generateCuratedListFormat(recentTasks, currentTask);
    
    return {
      infoText,
      strategyUsed: 'recent',
      usedLLMFilter: false,
      taskCount: previousTasks.length,
      filteredTaskCount: recentTasks.length
    };
  }

  /**
   * 策略3：LLM 智能筛选
   */
  private async fetchWithLLMFilter(
    previousTasks: Array<typeof agentSubTasks.$inferSelect>,
    currentTask: typeof agentSubTasks.$inferSelect,
    allTasksInGroup: Array<typeof agentSubTasks.$inferSelect>
  ): Promise<PrecedentInfoResult> {
    console.log('[前序信息获取] 使用策略: llm（LLM智能筛选）');
    
    const { selectedInfoText, selectorResponse } = await this.callPrecedentSelectorAgent(
      currentTask,
      allTasksInGroup
    );

    if (selectedInfoText) {
      return {
        infoText: selectedInfoText,
        strategyUsed: 'llm',
        usedLLMFilter: true,
        llmResponse: selectorResponse,
        taskCount: previousTasks.length,
        filteredTaskCount: -1 // LLM 筛选，无法精确统计
      };
    }

    // LLM 筛选返回空，抛出异常让调用者处理
    throw new Error('LLM 筛选返回空结果');
  }

  /**
   * 策略4：LLM 智能筛选，失败时降级到 all
   */
  private async fetchWithLLMFilterAndFallback(
    previousTasks: Array<typeof agentSubTasks.$inferSelect>,
    currentTask: typeof agentSubTasks.$inferSelect,
    allTasksInGroup: Array<typeof agentSubTasks.$inferSelect>,
    enableFallback: boolean
  ): Promise<PrecedentInfoResult> {
    console.log('[前序信息获取] 使用策略: llm-with-fallback（LLM筛选+降级）');
    
    try {
      const result = await this.fetchWithLLMFilter(previousTasks, currentTask, allTasksInGroup);
      return result;
    } catch (error) {
      if (enableFallback) {
        console.warn('[前序信息获取] LLM筛选失败，降级到 all 策略:', error);
        return await this.fetchAllTasks(previousTasks, currentTask);
      }
      throw error;
    }
  }

  /**
   * 生成精选清单格式
   */
  private async generateCuratedListFormat(
    sortedTasks: Array<typeof agentSubTasks.$inferSelect>,
    currentTask: typeof agentSubTasks.$inferSelect
  ): Promise<string> {
    let result = '';
    
    // === 新增：当前任务信息 ===
    result += '【当前任务信息】\n\n';
    
    // 1. 当前任务的最新MCP结果（只取1条）
    const latestMcpResult = await this.getCurrentTaskLatestMcpResult(currentTask);
    if (latestMcpResult) {
      result += '【当前任务MCP执行结果】\n';
      result += `• 工具：${latestMcpResult.toolName || '-'}.${latestMcpResult.actionName || '-'}\n`;
      result += `• 状态：${latestMcpResult.resultStatus}\n`;
      if (latestMcpResult.resultText) {
        result += `• 结果：${latestMcpResult.resultText}\n`;
      }
      if (latestMcpResult.errorMessage) {
        result += `• 错误：${latestMcpResult.errorMessage}\n`;
      }
      result += '\n';
    }
    
    // 2. 当前任务的最新用户建议（只取1条）
    const userSuggestion = await this.getCurrentTaskLatestUserSuggestion(currentTask);
    if (userSuggestion) {
      result += '【当前任务用户建议】\n';
      result += `1. ${userSuggestion}\n\n`;
    }
    
    // === 现有：前置任务信息 ===
    if (sortedTasks.length > 0) {
      result += '【前置任务结果清单】\n';
      result += '（请从以下列表中选择，subtaskId 为必填）\n\n';
      for (const task of sortedTasks) {
        // 🔴 传递 currentTask 以确定 MCP 查询范围
        const taskResultText = await this.getTextFromTask(task, currentTask);
        result += `【子任务 ${task.orderIndex}】
• subtaskId: ${task.id}
• 标题: ${task.taskTitle}
• 结果: ${taskResultText || '无结果'}
\n`;
      }
    }
    
    result += '【说明】请根据当前任务需要，参考上述相关结果。';
    
    return result;
  }

  /**
   * 从任务获取文本结果
   * @param task 前序任务
   * @param currentTask 当前任务（用于确定 MCP 查询范围）
   */
  private async getTextFromTask(
    task: typeof agentSubTasks.$inferSelect,
    currentTask: typeof agentSubTasks.$inferSelect
  ): Promise<string> {
    // 🔴🔴🔴 修复：MCP 结果优先于 task.resultText
    // 原因：task.resultText 可能只是通用的执行结论（如"已调用xxx"），
    //      而 MCP 结果包含具体的执行结果（如合规校验报告）
    
    // 1. 🔴 优先查询 MCP 执行历史（包含具体结果）
    const mcpHistoryText = await this.getMcpHistoryText(task, currentTask);
    if (mcpHistoryText) {
      return mcpHistoryText;
    }
    
    // 2. 其次用现成的 resultText
    if (task.resultText) {
      return task.resultText;
    }
    
    // 3. 再从 resultData 提取
    if (task.resultData) {
      const resultFromData = this.extractResultTextFromResultData(task.resultData, task.fromParentsExecutor);
      if (resultFromData) {
        return resultFromData;
      }
    }
    
    // 4. 兜底：空字符串
    return '';
  }

  /**
   * 🔴 从 MCP 执行历史中获取文本结果
   * @param task 前序任务
   * @param currentTask 当前任务（用于确定查询范围：[currentTask.orderIndex-1, currentTask.orderIndex]）
   */
  private async getMcpHistoryText(
    task: typeof agentSubTasks.$inferSelect,
    currentTask: typeof agentSubTasks.$inferSelect
  ): Promise<string> {
    try {
      // 🔴 使用 currentTask.orderIndex 确定查询范围
      // 条件 inArray([currentTask.orderIndex - 1, currentTask.orderIndex])
      // 原因：只查询当前任务和前一个任务的 MCP 结果，不包括更早的任务
      
      const queryOrderIndexes = [currentTask.orderIndex - 1, currentTask.orderIndex];
      console.log('[getMcpHistoryText] 🔍 查询 MCP 执行历史:', {
        task_order_index: task.orderIndex,
        current_task_order_index: currentTask.orderIndex,
        query_order_indexes: queryOrderIndexes,
        command_result_id: task.commandResultId
      });
      
      const mcpExecutions = await db
        .select()
        .from(agentSubTasksMcpExecutions)
        .where(
          and(
            eq(agentSubTasksMcpExecutions.commandResultId, task.commandResultId),
            // 🔴🔴🔴 使用 currentTask.orderIndex 确定范围
            // 例如当前任务 order_index=3 时，查询 [2, 3]，不包括 1
            inArray(
              agentSubTasksMcpExecutions.orderIndex,
              queryOrderIndexes
            )
          )
        )
        .orderBy(desc(agentSubTasksMcpExecutions.attemptTimestamp));
      
      console.log('[getMcpHistoryText] 📊 查询结果:', {
        found_count: mcpExecutions.length,
        order_indexes: mcpExecutions.map(e => e.orderIndex)
      });
      
      if (mcpExecutions.length === 0) {
        return '';
      }
      
      // 取最新的 MCP 执行结果
      const latestExecution = mcpExecutions[0];
      
      console.log('[getMcpHistoryText] ✅ 最新 MCP 执行结果:', {
        order_index: latestExecution.orderIndex,
        has_result_text: !!latestExecution.resultText,
        result_text_length: latestExecution.resultText?.length || 0
      });
      
      // 如果有 resultText，按指定格式返回
      if (latestExecution.resultText) {
        return `【前序MCP执行结果】
任务标题：${task.taskTitle || '-'}
任务序号：order_index=${latestExecution.orderIndex}
执行结果：${latestExecution.resultText}`;
      }
      
      // 如果没有 resultText 但有 resultData，尝试提取
      if (latestExecution.resultData) {
        return this.extractMcpResultFromResultData(latestExecution.resultData);
      }
      
      // 如果有错误信息，返回错误
      if (latestExecution.errorMessage) {
        return `【MCP执行失败】
错误：${latestExecution.errorMessage}`;
      }
      
      return '';
    } catch (error) {
      console.warn('[PrecedentInfoFetcher] 获取MCP历史失败:', error);
      return '';
    }
  }

  /**
   * 🔴 新增：从 MCP result_data 中提取合规审核结果等关键信息
   */
  private extractMcpResultFromResultData(resultData: any): string {
    if (!resultData) return '';
    
    // 确保是对象
    let data: any;
    if (typeof resultData === 'string') {
      try {
        data = JSON.parse(resultData);
      } catch {
        return resultData;
      }
    } else {
      data = resultData;
    }
    
    if (!data || typeof data !== 'object') {
      return '';
    }
    
    // 🔴 合规审核结果结构
    if (data.data?.approved !== undefined || data.approved !== undefined) {
      const approved = data.data?.approved ?? data.approved;
      const riskLevel = data.data?.riskLevel ?? data.riskLevel;
      const issues = data.data?.issues ?? data.issues;
      const suggestions = data.data?.suggestions ?? data.suggestions;
      const formattedSummary = data.data?.formattedSummary ?? data.formattedSummary;
      
      let result = '【合规审核结果】\n';
      result += `审核状态：${approved ? '通过' : '未通过'}\n`;
      
      if (riskLevel) {
        result += `风险等级：${riskLevel}\n`;
      }
      
      if (issues && Array.isArray(issues) && issues.length > 0) {
        result += `发现问题：\n`;
        issues.forEach((issue: string, idx: number) => {
          result += `  ${idx + 1}. ${issue}\n`;
        });
      }
      
      if (suggestions && Array.isArray(suggestions) && suggestions.length > 0) {
        result += `修改建议：\n`;
        suggestions.forEach((suggestion: string, idx: number) => {
          result += `  ${idx + 1}. ${suggestion}\n`;
        });
      }
      
      if (formattedSummary) {
        result += `\n详细整改意见：\n${formattedSummary}`;
      }
      
      return result;
    }
    
    // 🔴 通用 MCP 结果结构：尝试提取 success 和 data
    if (data.success === true && data.data) {
      const innerData = data.data;
      
      // 如果 innerData 本身是合规结果结构
      if (innerData.approved !== undefined || innerData.issues) {
        return this.extractMcpResultFromResultData(innerData);
      }
      
      // 其他类型的结果，返回 data 的字符串形式
      if (typeof innerData === 'string') {
        return innerData;
      }
      
      // 尝试返回 formattedSummary 或其他关键字段
      if (innerData.formattedSummary) {
        return innerData.formattedSummary;
      }
      
      // 返回整个 data 对象（限制长度）
      const dataStr = JSON.stringify(innerData, null, 2);
      return dataStr.length > 1000 ? dataStr.substring(0, 1000) + '...(已截断)' : dataStr;
    }
    
    // 兜底：返回整个对象的字符串形式
    const jsonStr = JSON.stringify(data, null, 2);
    return jsonStr.length > 500 ? jsonStr.substring(0, 500) + '...(已截断)' : jsonStr;
  }

  /**
   * 从 result_data 中提取执行结果文本
   * 🔥 委托给共享服务 extractResultTextCore（平台配置驱动 + 动态发现兜底）
   */
  private extractResultTextFromResultData(resultData: any, executor?: string): string {
    return extractResultTextCore(resultData, { executor });
  }

  /**
   * 查询当前任务的最新MCP执行结果（只取1条）
   */
  private async getCurrentTaskLatestMcpResult(
    task: typeof agentSubTasks.$inferSelect
  ): Promise<typeof agentSubTasksMcpExecutions.$inferSelect | null> {
    const results = await db
      .select()
      .from(agentSubTasksMcpExecutions)
      .where(
        and(
          eq(agentSubTasksMcpExecutions.commandResultId, task.commandResultId),
          eq(agentSubTasksMcpExecutions.orderIndex, task.orderIndex)
        )
      )
      .orderBy(desc(agentSubTasksMcpExecutions.attemptTimestamp))
      .limit(1);
    
    return results.length > 0 ? results[0] : null;
  }

  /**
   * 查询当前任务的最新用户建议（只取1条）
   */
  private async getCurrentTaskLatestUserSuggestion(
    task: typeof agentSubTasks.$inferSelect
  ): Promise<string | null> {
    const history = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, task.commandResultId),
          eq(agentSubTasksStepHistory.stepNo, task.orderIndex),
          eq(agentSubTasksStepHistory.interactUser, 'human'),
          eq(agentSubTasksStepHistory.interactType, 'response')
        )
      )
      .orderBy(desc(agentSubTasksStepHistory.interactTime))
      .limit(1);
    
    if (history.length === 0) return null;
    
    const content = history[0].interactContent as any;
    return content?.userDecision || null;
  }

  /**
   * 调用前序信息选择器Agent
   */
  private async callPrecedentSelectorAgent(
    task: typeof agentSubTasks.$inferSelect,
    allTasksInGroup: Array<typeof agentSubTasks.$inferSelect>
  ): Promise<{ selectedInfoText: string | null; selectorResponse: string | null }> {
    console.log('[前序信息获取] 调用前序信息选择器Agent...');

    try {
      // 1. 获取精选清单格式的前序信息（包含当前任务信息）
      const curatedPreviousResult = await this.generateCuratedListFormat(
        allTasksInGroup.filter(t => t.orderIndex < task.orderIndex),
        task
      );

      if (!curatedPreviousResult) {
        return { selectedInfoText: null, selectorResponse: null };
      }

      // 2. 构建选择器Agent的提示词
      const currentTaskText = `【当前任务】
任务标题：${task.taskTitle}
任务描述：${task.taskDescription}`;

      const selectorPrompt = `${curatedPreviousResult}

${currentTaskText}

---

【筛选任务】
请根据上述候选前序任务，为当前任务选择最相关的参考任务。

请按JSON格式返回你的选择结果（不要包含任何额外文字）：`;

      // 3. 调用选择器Agent - 使用专门的 PrecedentSelector 提示词
      const systemPrompt = loadFeaturePrompt('precedent-selector-system-prompt');
      const selectorResponse = await callLLM(
        task.fromParentsExecutor,
        '前序信息选择',
        systemPrompt,
        selectorPrompt
      );

      // 4. 解析选择结果并提取信息
      const { PrecedentSelectorController } = await import('@/lib/agents/precedent-selector-controller');
      
      const extractedInfo = await PrecedentSelectorController.extractPrecedentInfo(
        selectorResponse
      );

      const selectedInfoText = PrecedentSelectorController.assembleExecutionPrompt(
        currentTaskText,
        extractedInfo
      );

      console.log('[前序信息获取] LLM筛选成功');
      return { selectedInfoText, selectorResponse };

    } catch (error) {
      console.error('[前序信息获取] LLM筛选失败:', error);
      return { selectedInfoText: null, selectorResponse: null };
    }
  }
}

/**
 * 默认导出单例实例
 */
export default PrecedentInfoFetcher.getInstance();
