/**
 * 🔥 统一的前序信息获取服务
 * 
 * 设计原则：
 * - 入口：当前任务ID
 * - 返回：格式化的纯文本字符串（向后兼容）
 * - 内部处理：用户建议 + MCP结果 + 前置任务 + LLM筛选
 */

import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksMcpExecutions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

/**
 * 🔥 统一的前序信息获取服务
 */
export class UnifiedPrecedentInfoService {
  private static instance: UnifiedPrecedentInfoService;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): UnifiedPrecedentInfoService {
    if (!UnifiedPrecedentInfoService.instance) {
      UnifiedPrecedentInfoService.instance = new UnifiedPrecedentInfoService();
    }
    return UnifiedPrecedentInfoService.instance;
  }

  /**
   * 🔥 统一入口：根据任务ID获取前序信息
   * 
   * @param taskId 当前任务ID
   * @param options 选项
   * @returns 格式化的前序信息文本（直接可用）
   */
  public async getPrecedentInfoText(
    taskId: string,
    options: {
      enableLLMFilter?: boolean;  // 是否启用LLM筛选（默认true）
    } = { enableLLMFilter: true }
  ): Promise<string> {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║     [统一前序信息服务] 开始获取前序信息                    ║');
    console.log('║                     任务ID: ' + taskId + '                             ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');

    try {
      // 1. 根据任务ID查询数据
      console.log('[统一前序信息服务] [步骤1/3] 获取相关数据...');
      const { currentTask, allTasksInGroup, mcpExecutions, userSuggestions } = await this.fetchAllData(taskId);

      console.log('[统一前序信息服务] [步骤1/3] ✅ 数据获取完成:', {
        has_current_task: !!currentTask,
        all_tasks_count: allTasksInGroup.length,
        mcp_executions_count: mcpExecutions.length,
        user_suggestions_count: userSuggestions.length
      });

      // 2. 如果没有前序信息，直接返回空
      const hasPrecedentInfo = allTasksInGroup.some(t => t.orderIndex < currentTask.orderIndex) || 
                               mcpExecutions.length > 0 || 
                               userSuggestions.length > 0;

      if (!hasPrecedentInfo) {
        console.log('[统一前序信息服务] 没有前序信息，返回空字符串');
        console.log('╔═══════════════════════════════════════════════════════════╗');
        console.log('║     [统一前序信息服务] 获取完成（无前序信息）              ║');
        console.log('╚═══════════════════════════════════════════════════════════╝');
        console.log('');
        return '';
      }

      // 3. 强制使用LLM智能筛选策略
      console.log('[统一前序信息服务] [步骤2/3] 处理前序信息...');
      console.log('[统一前序信息服务] 强制使用LLM智能筛选策略');
      
      const resultText = await this.filterWithLLM(currentTask, allTasksInGroup, mcpExecutions, userSuggestions);

      console.log('[统一前序信息服务] [步骤2/3] ✅ 信息处理完成:', {
        strategy_used: 'llm-filter',
        result_length: resultText.length,
        result_preview: resultText.substring(0, 150) + '...'
      });

      console.log('[统一前序信息服务] [步骤3/3] ✅ 全部完成');
      console.log('╔═══════════════════════════════════════════════════════════╗');
      console.log('║     [统一前序信息服务] 获取成功                              ║');
      console.log('╚═══════════════════════════════════════════════════════════╝');
      console.log('');

      return resultText;

    } catch (error) {
      console.error('');
      console.error('╔═══════════════════════════════════════════════════════════╗');
      console.error('║     [统一前序信息服务] ❌ 获取失败                          ║');
      console.error('╚═══════════════════════════════════════════════════════════╝');
      console.error('[统一前序信息服务] 失败详情:', error);
      
      // 降级：返回空字符串，不影响主流程
      console.warn('[统一前序信息服务] 降级：返回空字符串');
      return '';
    }
  }

  /**
   * 🛒 数据获取层：获取所有相关数据
   * 
   * 职责：只负责"获取"，不负责"处理"
   */
  private async fetchAllData(taskId: string) {
    // 1. 查询当前任务
    const currentTask = await db.query.agentSubTasks.findFirst({
      where: eq(agentSubTasks.id, taskId)
    });

    if (!currentTask) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    // 2. 查询同组所有任务
    const allTasksInGroup = await db.query.agentSubTasks.findMany({
      where: eq(agentSubTasks.commandResultId, currentTask.commandResultId),
      orderBy: agentSubTasks.orderIndex
    });

    // 3. 查询MCP执行结果（预留接口，待后续实现）
    const mcpExecutions: any[] = [];
    // TODO: 实现 MCP 执行结果查询
    // if (currentTask.commandResultId) {
    //   mcpExecutions = await db.query.agentSubTasksMcpExecutions.findMany({
    //     where: eq(agentSubTasksMcpExecutions.commandResultId, currentTask.commandResultId)
    //   });
    // }

    // 4. 查询用户建议（预留接口，待后续实现）
    const userSuggestions: string[] = [];
    // TODO: 实现用户建议查询

    console.log('[统一前序信息服务] 数据获取完成:', {
      task_id: taskId,
      current_task_order_index: currentTask.orderIndex,
      all_tasks_in_group_count: allTasksInGroup.length,
      mcp_executions_count: mcpExecutions.length,
      user_suggestions_count: userSuggestions.length
    });

    return { currentTask, allTasksInGroup, mcpExecutions, userSuggestions };
  }

  /**
   * 👨‍🍳 数据处理层：使用LLM筛选
   * 
   * 职责：只负责"处理"，不负责"获取"
   */
  private async filterWithLLM(
    currentTask: any,
    allTasksInGroup: any[],
    mcpExecutions: any[],
    userSuggestions: string[]
  ): Promise<string> {
    console.log('[统一前序信息服务] 调用LLM进行智能筛选...');

    // 复用现有的 PrecedentInfoFetcher 逻辑
    const { PrecedentInfoFetcher } = await import('./precedent-info-fetcher');
    const fetcher = PrecedentInfoFetcher.getInstance();
    
    const result = await fetcher.fetchPrecedentInfo(currentTask, allTasksInGroup, {
      strategy: 'llm-with-fallback',
      enableFallback: true
    });

    console.log('[统一前序信息服务] LLM筛选完成:', {
      used_llm: result.usedLLMFilter,
      strategy_used: result.strategyUsed,
      result_length: result.infoText.length
    });

    return result.infoText;
  }

  /**
   * 👨‍🍳 数据处理层：构建所有信息的文本（不使用LLM筛选）
   * 
   * 职责：只负责"处理"，不负责"获取"
   */
  private async buildAllInfoText(
    currentTask: any,
    allTasksInGroup: any[],
    mcpExecutions: any[],
    userSuggestions: string[]
  ): Promise<string> {
    console.log('[统一前序信息服务] 构建全量前序信息文本...');

    const parts: string[] = [];

    // 1. 用户建议
    if (userSuggestions.length > 0) {
      parts.push('【用户建议】');
      userSuggestions.forEach((suggestion, index) => {
        parts.push(`${index + 1}. ${suggestion}`);
      });
      parts.push('');
    }

    // 2. 前置任务结果
    const previousTasks = allTasksInGroup
      .filter(t => t.orderIndex < currentTask.orderIndex)
      .sort((a, b) => b.orderIndex - a.orderIndex);

    if (previousTasks.length > 0) {
      // 复用现有的逻辑来获取任务文本
      const { PrecedentInfoFetcher } = await import('./precedent-info-fetcher');
      const fetcher = PrecedentInfoFetcher.getInstance();
      
      // 先获取所有前置任务的文本
      const result = await fetcher.fetchPrecedentInfo(currentTask, allTasksInGroup, {
        strategy: 'all',
        enableFallback: false
      });
      
      // 直接使用 fetcher 的结果
      if (result.infoText) {
        parts.push(result.infoText);
      }
    }

    // 3. MCP执行结果（预留接口，待后续实现）
    if (mcpExecutions.length > 0) {
      parts.push('【MCP执行结果】');
      // TODO: 实现 MCP 执行结果格式化
      parts.push('');
    }

    // 添加说明
    if (parts.length > 0) {
      parts.push('【说明】请根据当前任务需要，参考上述相关结果。');
    }

    const resultText = parts.join('\n');
    
    console.log('[统一前序信息服务] 全量信息文本构建完成:', {
      parts_count: parts.length,
      result_length: resultText.length
    });

    return resultText;
  }
}

/**
 * 默认导出单例实例
 */
export default UnifiedPrecedentInfoService.getInstance();
