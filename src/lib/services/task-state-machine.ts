/**
 * 任务状态机服务
 *
 * 业界优秀实践：状态机 + 乐观锁
 *
 * 功能：
 * 1. 严格的状态流转控制
 * 2. 乐观锁防止并发冲突
 * 3. 用户反馈优先于定时任务
 * 4. 所有状态变更可追溯
 */

import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

/**
 * 任务状态枚举
 */
export type TaskStatus = 
  | 'pending' 
  | '未拆解'
  | '拆解中'
  | '拆解完成'
  | 'in_progress' 
  | 'waiting_user' 
  | 'pre_completed' 
  | 'pre_need_support'
  | 'need_support'
  | 'completed' 
  | 'cancelled';

/**
 * 指令/子任务执行状态枚举
 * 用于 daily_task.executionStatus 字段
 */
export const CommandStatus = {
  NEW: 'new',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type CommandStatusType = typeof CommandStatus[keyof typeof CommandStatus];

/**
 * 状态常量（向后兼容）
 */
export const TaskStatusConst = {
  UNSPLIT: '未拆解' as TaskStatus,
  SPLITTING: '拆解中' as TaskStatus,
  SPLIT_COMPLETED: '拆解完成' as TaskStatus,
  PENDING: 'pending' as TaskStatus,
  IN_PROGRESS: 'in_progress' as TaskStatus,
  WAITING_USER: 'waiting_user' as TaskStatus,
  PRE_COMPLETED: 'pre_completed' as TaskStatus,
  PRE_NEED_SUPPORT: 'pre_need_support' as TaskStatus,
  NEED_SUPPORT: 'need_support' as TaskStatus,
  COMPLETED: 'completed' as TaskStatus,
  CANCELLED: 'cancelled' as TaskStatus,
};

/**
 * 状态流转规则
 * 定义哪些状态转换是允许的
 */
export const STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  'pending': ['in_progress', 'cancelled', '未拆解'],
  '未拆解': ['拆解中', 'pending', 'cancelled'],
  '拆解中': ['拆解完成', '未拆解', 'cancelled'],
  '拆解完成': ['in_progress', 'pending', 'cancelled'],
  'in_progress': ['waiting_user', 'pre_completed', 'pre_need_support', 'completed', 'cancelled'],
  'waiting_user': ['in_progress', 'completed', 'cancelled'],
  'pre_completed': ['completed', 'in_progress', 'waiting_user', 'cancelled'],
  'pre_need_support': ['need_support', 'in_progress', 'waiting_user', 'cancelled'],
  'need_support': ['in_progress', 'completed', 'cancelled'],
  'completed': [],
  'cancelled': [],
};

/**
 * 操作来源枚举
 * 用于区分是用户操作还是定时任务
 */
export type OperationSource = 'user_feedback' | 'scheduled_task' | 'system';

/**
 * 状态更新结果
 */
export interface StateUpdateResult {
  success: boolean;
  conflict?: boolean;
  invalidTransition?: boolean;
  newVersion?: number;
  message?: string;
}

/**
 * 任务状态机服务类
 */
export class TaskStateMachine {
  private static instance: TaskStateMachine;

  private constructor() {}

  public static getInstance(): TaskStateMachine {
    if (!TaskStateMachine.instance) {
      TaskStateMachine.instance = new TaskStateMachine();
    }
    return TaskStateMachine.instance;
  }

  /**
   * 检查状态转换是否合法
   */
  public isValidTransition(fromStatus: TaskStatus, toStatus: TaskStatus): boolean {
    const allowedTransitions = STATUS_TRANSITIONS[fromStatus] || [];
    return allowedTransitions.includes(toStatus);
  }

  /**
   * 检查是否应该优先处理（用户反馈 > 定时任务）
   */
  public shouldPrioritize(source: OperationSource): boolean {
    // 用户反馈优先级最高
    return source === 'user_feedback';
  }

  /**
   * 带乐观锁的状态更新
   *
   * @param taskId 任务ID
   * @param currentVersion 当前版本号
   * @param newStatus 新状态
   * @param source 操作来源
   * @param extraData 额外数据（executionResult, statusProof等）
   */
  public async updateStateWithLock(
    taskId: string,
    currentVersion: number,
    newStatus: TaskStatus,
    source: OperationSource,
    extraData?: {
      executionResult?: any;
      statusProof?: any;
      metadata?: Record<string, any>;
    }
  ): Promise<StateUpdateResult> {
    const now = getCurrentBeijingTime();

    // 1. 先查询当前任务状态
    const tasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, taskId));

    if (tasks.length === 0) {
      return {
        success: false,
        message: '任务不存在',
      };
    }

    const task = tasks[0];
    const currentStatus = task.status as TaskStatus;

    // 2. 检查状态流转是否合法
    if (!this.isValidTransition(currentStatus, newStatus)) {
      console.log('[StateMachine] 非法状态转换:', {
        taskId,
        from: currentStatus,
        to: newStatus,
        source,
      });

      return {
        success: false,
        invalidTransition: true,
        message: `非法状态转换: ${currentStatus} → ${newStatus}`,
      };
    }

    // 3. 如果是定时任务，检查是否有用户反馈正在处理
    if (source === 'scheduled_task') {
      const hasRecentUserFeedback = await this.checkRecentUserFeedback(task);
      if (hasRecentUserFeedback) {
        console.log('[StateMachine] 检测到用户反馈，定时任务放弃执行:', taskId);
        return {
          success: false,
          message: '检测到用户反馈，定时任务已让道',
        };
      }
    }

    try {
      // 4. 带乐观锁的更新
      const updateData: any = {
        status: newStatus,
        version: currentVersion + 1,
        updatedAt: now,
      };

      if (extraData?.executionResult !== undefined) {
        updateData.executionResult = extraData.executionResult;
      }
      if (extraData?.statusProof !== undefined) {
        updateData.statusProof = extraData.statusProof;
      }
      if (extraData?.metadata) {
        updateData.metadata = { ...task.metadata, ...extraData.metadata };
      }

      // 如果是开始执行，设置 startedAt
      if (newStatus === 'in_progress' && !task.startedAt) {
        updateData.startedAt = now;
      }

      const result = await db
        .update(agentSubTasks)
        .set(updateData)
        .where(
          and(
            eq(agentSubTasks.id, taskId),
            eq(agentSubTasks.version, currentVersion)
          )
        );

      // 5. 检查是否更新成功
      if (result.count === 0) {
        console.log('[StateMachine] 乐观锁冲突:', {
          taskId,
          expectedVersion: currentVersion,
          source,
        });

        return {
          success: false,
          conflict: true,
          message: '并发冲突，请重试',
        };
      }

      console.log('[StateMachine] 状态更新成功:', {
        taskId,
        from: currentStatus,
        to: newStatus,
        source,
        newVersion: currentVersion + 1,
      });

      // 6. 记录状态变更历史（可选，用于审计）
      await this.recordStateChange(taskId, currentStatus, newStatus, source, extraData);

      return {
        success: true,
        newVersion: currentVersion + 1,
        message: '状态更新成功',
      };

    } catch (error) {
      console.error('[StateMachine] 状态更新失败:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '状态更新失败',
      };
    }
  }

  /**
   * 检查是否有最近的用户反馈
   * 如果有，定时任务应该让道
   */
  private async checkRecentUserFeedback(task: typeof agentSubTasks.$inferSelect): Promise<boolean> {
    if (!task.commandResultId) {
      return false;
    }

    const FIVE_MINUTES = 5 * 60 * 1000;
    const now = getCurrentBeijingTime();

    // 查询最近的历史记录
    const recentHistory = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, task.commandResultId),
          eq(agentSubTasksStepHistory.stepNo, task.orderIndex)
        )
      )
      .orderBy(agentSubTasksStepHistory.interactTime)
      .limit(1);

    if (recentHistory.length === 0) {
      return false;
    }

    const latestRecord = recentHistory[0];

    // 如果是用户反馈，且在5分钟内
    if (latestRecord.interactType === 'response' &&
        latestRecord.interactUser === 'human' &&
        latestRecord.interactTime) {
      const elapsed = now.getTime() - latestRecord.interactTime.getTime();
      return elapsed < FIVE_MINUTES;
    }

    return false;
  }

  /**
   * 记录状态变更历史（用于审计）
   */
  private async recordStateChange(
    taskId: string,
    fromStatus: TaskStatus,
    toStatus: TaskStatus,
    source: OperationSource,
    extraData?: any
  ) {
    // 这里可以插入到审计日志表
    // 暂时用 console.log 记录
    console.log('[StateMachine] [Audit] 状态变更:', {
      taskId,
      from: fromStatus,
      to: toStatus,
      source,
      timestamp: getCurrentBeijingTime().toISOString(),
      extraData: extraData ? '...' : undefined,
    });
  }

  /**
   * 重试更新（带指数退避）
   * 用于处理乐观锁冲突
   */
  public async updateStateWithRetry(
    taskId: string,
    newStatus: TaskStatus,
    source: OperationSource,
    extraData?: any,
    maxRetries: number = 3
  ): Promise<StateUpdateResult> {
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // 1. 查询当前任务状态和版本号
      const tasks = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.id, taskId));

      if (tasks.length === 0) {
        return { success: false, message: '任务不存在' };
      }

      const task = tasks[0];
      const currentVersion = task.version || 1;

      // 2. 尝试更新
      const result = await this.updateStateWithLock(
        taskId,
        currentVersion,
        newStatus,
        source,
        extraData
      );

      if (result.success || !result.conflict) {
        return result;
      }

      // 3. 如果是冲突，等待后重试
      lastError = result;
      const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // 指数退避，最大5秒
      console.log(`[StateMachine] 冲突，${delay}ms 后重试 (${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    return {
      success: false,
      conflict: true,
      message: `重试 ${maxRetries} 次后仍然冲突`,
    };
  }
}

// 导出单例实例
export const taskStateMachine = TaskStateMachine.getInstance();
