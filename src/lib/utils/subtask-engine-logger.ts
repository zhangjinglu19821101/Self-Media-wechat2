/**
 * Subtask Engine Logger
 * 专门为 Subtask Execution Engine 的日志工具类
 * 封装常用的日志打印逻辑，提高代码可读性
 */

import { getCurrentBeijingTime } from './date-time';

/**
 * 任务信息类型定义
 */
interface TaskInfo {
  id: string;
  commandResultId: string;
  orderIndex: number;
  status: string;
  fromParentsExecutor?: string;
  taskTitle?: string;
  resultData?: any;
  [key: string]: any;
}

/**
 * Subtask Engine Logger 类
 */
export class SubtaskEngineLogger {
  private static instance: SubtaskEngineLogger;
  
  private constructor() {}
  
  /**
   * 获取单例实例
   */
  public static getInstance(): SubtaskEngineLogger {
    if (!SubtaskEngineLogger.instance) {
      SubtaskEngineLogger.instance = new SubtaskEngineLogger();
    }
    return SubtaskEngineLogger.instance;
  }

  /**
   * 打印分隔线
   */
  public printSeparator(): void {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
  }

  /**
   * 打印待执行任务列表
   */
  public logPendingTasks(tasks: TaskInfo[]): void {
    console.log('[SubtaskEngine] ========== 获取待执行的子任务 ==========');
    console.log('[SubtaskEngine] 待执行任务数:', tasks.length);
    console.log('[SubtaskEngine] 任务列表:', tasks.map(t => ({
      id: t.id,
      command_result_id: t.commandResultId,
      order_index: t.orderIndex,
      status: t.status,
      task_title: t.taskTitle
    })));
  }

  /**
   * 打印分组信息
   */
  public logGroupInfo(groupId: string, tasksCount: number): void {
    console.log('[SubtaskEngine] ========== 开始处理分组 ==========');
    console.log('[SubtaskEngine] 分组信息:', {
      command_result_id: groupId,
      tasks_count: tasksCount
    });
  }

  /**
   * 打印分组完成信息
   */
  public logGroupComplete(groupId: string, processedOrderIndex: number | null): void {
    if (processedOrderIndex) {
      console.log('[SubtaskEngine] ========== 分组处理完成 ==========', {
        command_result_id: groupId,
        processed_order_index: processedOrderIndex
      });
    } else {
      console.log('[SubtaskEngine] 分组所有任务已完成', {
        command_result_id: groupId
      });
      console.log('[SubtaskEngine] ========== 分组处理完成（全部完成） ==========');
    }
  }

  /**
   * 打印目标 order_index
   */
  public logTargetOrderIndex(
    groupId: string,
    orderIndex: number,
    tasksCount: number,
    tasks: TaskInfo[]
  ): void {
    console.log('[SubtaskEngine] 处理目标 order_index:', {
      command_result_id: groupId,
      order_index: orderIndex,
      tasks_count: tasksCount,
      tasks: tasks.map(t => ({
        id: t.id,
        status: t.status,
        executor: t.fromParentsExecutor
      }))
    });
  }

  /**
   * 打印 processOrderIndexTasks 开始
   */
  public logProcessOrderIndexStart(
    groupId: string,
    orderIndex: number,
    tasksCount: number,
    tasks: TaskInfo[]
  ): void {
    console.log('');
    console.log('[SubtaskEngine] ========== processOrderIndexTasks 开始 ==========');
    console.log('[SubtaskEngine] 处理信息:', {
      command_result_id: groupId,
      order_index: orderIndex,
      tasks_count: tasksCount,
      tasks: tasks.map(t => ({
        id: t.id,
        status: t.status,
        executor: t.fromParentsExecutor
      }))
    });
  }

  /**
   * 打印检查进行中的任务
   */
  public logCheckInProgressTasks(groupId: string, orderIndex: number, tasksCount: number): void {
    console.log('[SubtaskEngine] 检查进行中的任务（仅超时检测）:', {
      command_result_id: groupId,
      order_index: orderIndex,
      tasks_count: tasksCount
    });
  }

  /**
   * 打印等待用户交互
   */
  public logWaitingUser(groupId: string, orderIndex: number, tasksCount: number): void {
    console.log('[SubtaskEngine] 等待用户交互:', {
      command_result_id: groupId,
      order_index: orderIndex,
      tasks_count: tasksCount
    });
  }

  /**
   * 打印 Agent B 评审
   */
  public logAgentBReview(groupId: string, orderIndex: number, tasksCount: number): void {
    console.log('[SubtaskEngine] Agent B 评审:', {
      command_result_id: groupId,
      order_index: orderIndex,
      tasks_count: tasksCount
    });
  }

  /**
   * 打印执行 pending 任务
   */
  public logExecutePendingTasks(groupId: string, orderIndex: number, tasksCount: number): void {
    console.log('[SubtaskEngine] 执行 pending 任务:', {
      command_result_id: groupId,
      order_index: orderIndex,
      tasks_count: tasksCount
    });
  }

  /**
   * 打印当前步骤所有任务已完成
   */
  public logAllTasksComplete(groupId: string, orderIndex: number): void {
    console.log('[SubtaskEngine] 当前步骤所有任务已完成:', {
      command_result_id: groupId,
      order_index: orderIndex
    });
  }

  /**
   * 打印执行Agent开始
   */
  public logExecutorAgentStart(task: TaskInfo): void {
    console.log(`[SubtaskEngine] ========== 执行Agent开始处理 ==========`, {
      command_result_id: task.commandResultId,
      task_id: task.id,
      order_index: task.orderIndex,
      executor: task.fromParentsExecutor
    });
  }

  /**
   * 打印阶段信息
   */
  public logPhase(phase: string, phaseName: string, message?: string): void {
    console.log(`[执行Agent追踪] [${phaseName}] ${message || ''}`);
  }

  /**
   * 打印同组任务概览
   */
  public logGroupTasksOverview(
    commandResultId: string,
    allTasksInGroup: TaskInfo[]
  ): void {
    console.log('[执行Agent追踪] 同组任务概览:', {
      command_result_id: commandResultId,
      total_tasks: allTasksInGroup.length,
      order_indexes: allTasksInGroup.map(t => t.orderIndex).join(', '),
      tasks: allTasksInGroup.map(t => ({
        id: t.id,
        order_index: t.orderIndex,
        status: t.status,
        has_execution_result: !!t.resultData,
        execution_result_length: t.resultData ? t.resultData.length : 0
      }))
    });
  }

  /**
   * 打印历史结果服务查询完成
   */
  public logPreviousResultComplete(
    commandResultId: string,
    previousResultText: string
  ): void {
    console.log('[执行Agent追踪] [重构52/5] 历史结果服务查询完成:', {
      command_result_id: commandResultId,
      service_used: 'UnifiedPrecedentInfoService',
      result_length: previousResultText.length,
      has_result: previousResultText.length > 0,
      result_preview: previousResultText.substring(0, 150) + (previousResultText.length > 150 ? '...' : '')
    });
  }

  /**
   * 打印执行Agent完成
   */
  public logExecutorAgentComplete(
    commandResultId: string,
    taskId: string,
    orderIndex: number,
    executorResult: any
  ): void {
    console.log('[执行Agent追踪] [重构53/5] 执行Agent完成');
    console.log('[执行Agent追踪] 执行Agent结果:', {
      command_result_id: commandResultId,
      task_id: taskId,
      order_index: orderIndex,
      is_completed: executorResult.isCompleted,
      has_result: executorResult.result !== null && executorResult.result !== undefined,
      has_suggestion: executorResult.suggestion !== null && executorResult.suggestion !== undefined,
      result_preview: executorResult.result ? 
        (typeof executorResult.result === 'string' ? 
          executorResult.result.substring(0, 150) + '...' : 
          JSON.stringify(executorResult.result).substring(0, 150) + '...') : 
        null,
      suggestion_preview: executorResult.suggestion ? 
        executorResult.suggestion.substring(0, 150) + '...' : 
        null
    });
  }

  /**
   * 打印Agent B评审开始
   */
  public logAgentBReviewStart(task: TaskInfo): void {
    console.log('[SubtaskEngine] Agent B: 评审开始', {
      command_result_id: task.commandResultId,
      task_id: task.id,
      order_index: task.orderIndex,
      status: task.status
    });
  }

  /**
   * 打印Agent B评审类型
   */
  public logAgentBReviewType(task: TaskInfo, type: string, description: string): void {
    console.log(`[SubtaskEngine] Agent B: 评审 ${type} 状态（${description}）`, {
      command_result_id: task.commandResultId,
      task_id: task.id
    });
  }

  /**
   * 打印Agent B决策开始
   */
  public logAgentBDecisionStart(task: TaskInfo): void {
    console.log('[SubtaskEngine] ========== 开始 Agent B 决策 + MCP 执行 ==========');
    console.log('[SubtaskEngine] 任务信息:', {
      command_result_id: task.commandResultId,
      task_id: task.id,
      order_index: task.orderIndex,
      status: task.status
    });
  }

  /**
   * 打印超时检查开始
   */
  public logTimeoutCheckStart(timeoutMs: number, tasksCount: number): void {
    console.log('[SubtaskEngine] ========== 开始检查超时任务 ==========');
    console.log('[SubtaskEngine] 超时阈值:', timeoutMs / 1000 / 60, '分钟');
    console.log('[SubtaskEngine] 待检查任务数:', tasksCount);
  }

  /**
   * 打印检查任务超时
   */
  public logCheckTaskTimeout(
    task: TaskInfo,
    startedAt: Date,
    elapsedTime: number,
    timeoutMs: number
  ): void {
    const elapsedMinutes = elapsedTime / 1000 / 60;
    console.log('[SubtaskEngine] 检查任务超时:', {
      task_id: task.id,
      command_result_id: task.commandResultId,
      order_index: task.orderIndex,
      started_at: startedAt,
      elapsed_time_ms: elapsedTime,
      elapsed_time_minutes: elapsedMinutes.toFixed(2),
      timeout_threshold_minutes: timeoutMs / 1000 / 60
    });
  }

  /**
   * 打印检测到超时任务
   */
  public logTimeoutDetected(
    task: TaskInfo,
    elapsedMinutes: number,
    metadata: any
  ): void {
    console.log('[SubtaskEngine] ========== 检测到超时任务 ==========');
    console.log('[SubtaskEngine] 任务', task.id, '已超时', elapsedMinutes.toFixed(2), '分钟');
    console.log('[SubtaskEngine] 简化方案：直接转为 pre_need_support 状态，复用 Agent B 审核功能');
    console.log('[SubtaskEngine] 超时元数据:', metadata);
  }

  /**
   * 打印超时处理完成
   */
  public logTimeoutHandled(taskId: string): void {
    console.log('[SubtaskEngine] 已转为 pre_need_support 状态，Agent B 将介入评审');
  }

  /**
   * 打印任务未超时
   */
  public logTaskNotTimeout(taskId: string): void {
    console.log('[SubtaskEngine] 任务', taskId, '未超时，继续执行中');
  }

  /**
   * 打印超时检查完成
   */
  public logTimeoutCheckComplete(): void {
    console.log('[SubtaskEngine] ========== 超时检查完成 ==========');
  }

  /**
   * 打印检测到用户反馈
   */
  public logUserFeedbackDetected(interactTime: Date): void {
    console.log('[SubtaskEngine] 检测到用户反馈:', interactTime);
  }

  /**
   * 打印用户反馈处理完成
   */
  public logUserFeedbackHandled(taskId: string): void {
    console.log('[SubtaskEngine] 用户反馈处理完成，任务', taskId, '已重置为 pending 状态');
  }

  /**
   * 打印单引擎运行完成
   */
  public logSingleEngineComplete(): void {
    console.log('[SubtaskEngine] ========== 单次引擎运行完成 ==========');
  }
}

/**
 * 导出单例实例
 */
export const subtaskEngineLogger = SubtaskEngineLogger.getInstance();
