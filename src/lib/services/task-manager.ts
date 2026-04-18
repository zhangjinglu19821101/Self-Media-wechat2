/**
 * 任务管理服务
 * 负责管理 Agent 任务的生命周期、状态跟踪和进展记录
 *
 * 📋 API 参数到数据库字段的完整映射规则
 * ==========================================
 *
 * 【核心原则】
 * 1. 优先使用新字段（task_* 前缀），旧字段保持兼容
 * 2. 必填字段必须提供默认值，避免 null 插入失败
 * 3. 业务规则显式化，不要依赖隐式约定
 *
 * 【字段映射表】
 * ┌─────────────────┬─────────────────┬─────────────────────────────────────┐
 * │ API 参数         │ 数据库字段       │ 映射规则与业务含义                   │
 * ├─────────────────┼─────────────────┼─────────────────────────────────────┤
 * │ data.taskId     │ taskId          │ 直接使用，格式：task-{from}-to-{to}-{ts} │
 * │ data.taskName   │ taskName        │ 默认："任务 {taskId}"                │
 * │ data.command    │ coreCommand     │ 直接使用，完整指令内容（向量库字段）   │
 * │ data.command    │ command         │ 兼容字段，与 coreCommand 相同        │
 * │ data.executor   │ executor        │ 默认：data.toAgentId（接收方=执行方） │
 * │ data.toAgentId  │ executor (fallback)│ 如果未指定 executor，使用 toAgentId │
 * │ data.taskDurationStart │ taskDurationStart │ 默认：当前时间（任务创建时间）│
 * │ data.taskDurationEnd   │ taskDurationEnd   │ 默认：当前时间（后续更新截止日期）│
 * │ data.totalDeliverables │ totalDeliverables │ 默认："0"（执行完成后更新）      │
 * │ data.taskPriority│ taskPriority    │ 默认：data.priority 或 'normal'       │
 * │ data.priority   │ taskPriority (fallback)│ 兼容旧参数名                    │
 * │ data.taskStatus │ taskStatus      │ 默认：data.status 或 'pending'       │
 * │ data.status     │ taskStatus (fallback) │ 兼容旧参数名                │
 * │ data.creator    │ creator         │ 默认：data.fromAgentId              │
 * │ data.updater    │ updater         │ 默认：data.fromAgentId              │
 * │ data.remarks    │ remarks         │ 默认：空字符串                      │
 * │ data.fromAgentId│ fromAgentId     │ 直接使用（兼容字段）                │
 * │ data.toAgentId  │ toAgentId       │ 直接使用（兼容字段）                │
 * │ data.commandType│ commandType     │ 默认：'instruction'                  │
 * │ data.priority   │ priority        │ 兼容字段，与 taskPriority 相同      │
 * │ data.status     │ status          │ 兼容字段，与 taskStatus 相同       │
 * │ data.result     │ result          │ 默认：null（执行完成后填写）         │
 * │ data.metadata   │ metadata        │ 直接使用，附加元数据                │
 * └─────────────────┴─────────────────┴─────────────────────────────────────┘
 *
 * 【重要业务规则】
 * 1. executor 的默认规则：
 *    - 通常：接收方即执行方（toAgentId = executor）
 *    - 特殊：未来可能支持任务转发（A→B，B→C，此时 executor=C）
 *
 * 2. taskDurationEnd 的处理：
 *    - 创建时：设为当前时间（避免 null 错误）
 *    - 后续：根据指令中的时间表达式更新（"本周内" → 2026-01-17）
 *
 * 3. 新旧字段的优先级：
 *    - 新字段优先（taskPriority > priority）
 *    - 旧字段保留兼容（兼容旧 API 调用）
 */

import { db } from '@/lib/db';
import { agentTasks, type AgentTask, type NewAgentTask } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createAgentTaskWithDuplicateCheck } from './command-result-service';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

export class TaskManager {
  /**
   * 创建新任务
   */
  static async createTask(data: NewAgentTask | any): Promise<AgentTask> {
    // 🔥 兼容旧接口：补充缺失的必填字段
    // 先判断是否需要设置为 splitting 状态
    const isSplitting = data.splitStatus === 'splitting' || data.status === 'splitting';
    
    const coreCommand = data.coreCommand || data.command || '';
    const taskId = data.taskId;
    const executor = data.executor || data.toAgentId || '';
    const fromAgentId = data.fromAgentId || '';
    const toAgentId = data.toAgentId || '';
    const taskName = data.taskName || `任务 ${taskId}`;

    console.log(`🔍 [TaskManager] 开始创建任务: ${taskId}`);

    // 🔥 使用带防重功能的公共方法
    const result = await createAgentTaskWithDuplicateCheck({
      taskId: taskId,
      taskName: taskName,
      coreCommand: coreCommand,
      executor: executor,
      fromAgentId: fromAgentId,
      toAgentId: toAgentId,
      acceptanceCriteria: data.acceptanceCriteria || '待补充',
      taskType: data.taskType || 'master',
      splitStatus: data.splitStatus || (isSplitting ? 'splitting' : 'pending'),
      taskDurationStart: data.taskDurationStart || getCurrentBeijingTime(),
      taskDurationEnd: data.taskDurationEnd || getCurrentBeijingTime(),
      totalDeliverables: data.totalDeliverables?.toString() || '0',
      taskPriority: data.taskPriority || data.priority || 'normal',
      taskStatus: data.taskStatus || data.status || 'pending',
      creator: data.creator || fromAgentId,
      updater: data.updater || fromAgentId,
      metadata: data.metadata || {},
      timeWindowDays: 7,
    });

    if (result.isDuplicate) {
      console.log(`⚠️ [TaskManager] 检测到重复任务: ${taskId}, 返回已存在的任务`);
      
      // 查询已存在的任务并返回
      const [existingTask] = await db
        .select()
        .from(agentTasks)
        .where(eq(agentTasks.taskId, taskId))
        .limit(1);
      
      if (existingTask) {
        return existingTask;
      }
      
      throw new Error(`重复任务检测成功，但查询已存在任务失败: ${taskId}`);
    }

    console.log(`✅ [TaskManager] 任务已创建: taskId=${taskId}, taskName=${taskName}, from=${fromAgentId}, to=${toAgentId}`);
    return result.data!;
  }

  /**
   * 更新任务状态
   */
  static async updateTaskStatus(
    taskId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'failed',
    result?: string
  ): Promise<AgentTask | null> {
    const updates: any = {
      status,
      updatedAt: getCurrentBeijingTime(),
    };

    if (status === 'completed' || status === 'failed') {
      updates.completedAt = getCurrentBeijingTime();
    }

    if (result) {
      updates.result = result;
    }

    const [task] = await db
      .update(agentTasks)
      .set(updates)
      .where(eq(agentTasks.taskId, taskId))
      .returning();

    if (task) {
      console.log(`✅ 任务状态已更新: taskId=${taskId}, status=${status}`);
    }

    return task;
  }

  /**
   * 获取任务详情
   */
  static async getTask(taskId: string): Promise<AgentTask | null> {
    const [task] = await db
      .select()
      .from(agentTasks)
      .where(eq(agentTasks.taskId, taskId));

    return task || null;
  }

  /**
   * 获取发送方的所有任务（查看下达的任务）
   */
  static async getTasksByFromAgent(fromAgentId: string): Promise<AgentTask[]> {
    const tasks = await db
      .select()
      .from(agentTasks)
      .where(eq(agentTasks.fromAgentId, fromAgentId))
      .orderBy(desc(agentTasks.createdAt));

    return tasks;
  }

  /**
   * 获取接收方的所有任务（查看收到的任务）
   */
  static async getTasksByToAgent(toAgentId: string): Promise<AgentTask[]> {
    const tasks = await db
      .select()
      .from(agentTasks)
      .where(eq(agentTasks.toAgentId, toAgentId))
      .orderBy(desc(agentTasks.createdAt));

    return tasks;
  }

  /**
   * 获取两个 Agent 之间的所有任务
   */
  static async getTasksBetweenAgents(
    fromAgentId: string,
    toAgentId: string
  ): Promise<AgentTask[]> {
    const tasks = await db
      .select()
      .from(agentTasks)
      .where(
        and(
          eq(agentTasks.fromAgentId, fromAgentId),
          eq(agentTasks.toAgentId, toAgentId)
        )
      )
      .orderBy(desc(agentTasks.createdAt));

    return tasks;
  }

  /**
   * 获取所有待处理任务
   */
  static async getPendingTasks(): Promise<AgentTask[]> {
    const tasks = await db
      .select()
      .from(agentTasks)
      .where(eq(agentTasks.status, 'pending'))
      .orderBy(agentTasks.createdAt);

    return tasks;
  }

  /**
   * 获取所有进行中的任务
   */
  static async getInProgressTasks(): Promise<AgentTask[]> {
    const tasks = await db
      .select()
      .from(agentTasks)
      .where(eq(agentTasks.status, 'in_progress'))
      .orderBy(agentTasks.createdAt);

    return tasks;
  }

  /**
   * 添加任务进展
   */
  static async addTaskProgress(taskId: string, progress: string): Promise<void> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    const currentProgress = task.metadata?.progress || [];
    const progressEntry = {
      timestamp: getCurrentBeijingTime().toISOString(),
      content: progress,
    };

    await db
      .update(agentTasks)
      .set({
        metadata: {
          ...task.metadata,
          progress: [...currentProgress, progressEntry],
        },
        updatedAt: getCurrentBeijingTime(),
      })
      .where(eq(agentTasks.taskId, taskId));

    console.log(`✅ 任务进展已添加: taskId=${taskId}`);
  }

  /**
   * 获取任务统计
   */
  static async getTaskStats(agentId: string) {
    const sentTasks = await this.getTasksByFromAgent(agentId);
    const receivedTasks = await this.getTasksByToAgent(agentId);

    return {
      sent: {
        total: sentTasks.length,
        pending: sentTasks.filter((t) => t.status === 'pending').length,
        inProgress: sentTasks.filter((t) => t.status === 'in_progress').length,
        completed: sentTasks.filter((t) => t.status === 'completed').length,
        failed: sentTasks.filter((t) => t.status === 'failed').length,
      },
      received: {
        total: receivedTasks.length,
        pending: receivedTasks.filter((t) => t.status === 'pending').length,
        inProgress: receivedTasks.filter((t) => t.status === 'in_progress').length,
        completed: receivedTasks.filter((t) => t.status === 'completed').length,
        failed: receivedTasks.filter((t) => t.status === 'failed').length,
      },
    };
  }

  // 🔥 新增：两层任务体系管理方法

  /**
   * 创建总任务（Agent A 下达给 Agent B 拆解）
   */
  static async createAgentTask(data: {
    taskId: string;
    taskName: string;
    coreCommand: string;
    acceptanceCriteria: string; // 验收标准
    executor: string; // 执行主体（如：技术专家团队）
    taskType: 'daily' | 'special' | 'emergency'; // 任务类型
    fromAgentId: string;
    toAgentId: string;
    taskDurationStart?: Date;
    taskDurationEnd?: Date;
    taskPriority?: 'urgent' | 'normal' | 'low';
    remarks?: string;
    metadata?: Record<string, any>;
  }): Promise<AgentTask> {
    const taskData: NewAgentTask = {
      taskId: data.taskId,
      taskName: data.taskName,
      coreCommand: data.coreCommand,
      executor: data.executor,
      taskDurationStart: data.taskDurationStart || getCurrentBeijingTime(),
      taskDurationEnd: data.taskDurationEnd || getCurrentBeijingTime(),
      totalDeliverables: 0,
      taskPriority: data.taskPriority || 'normal',
      taskStatus: 'pending',
      creator: data.fromAgentId,
      updater: data.fromAgentId,
      remarks: data.remarks || '',
      // 旧字段（保持兼容）
      fromAgentId: data.fromAgentId,
      command: data.coreCommand,
      commandType: 'instruction',
      result: null,
      metadata: data.metadata || {
        acceptanceCriteria: data.acceptanceCriteria, // 验收标准存储在 metadata 中
        taskType: data.taskType,
      },
      // 🔥 新增字段（从 schema 读取）
      toAgentId: data.toAgentId,
    };

    const [task] = await db.insert(agentTasks).values(taskData).returning();
    console.log(`✅ 总任务已创建: taskId=${task.taskId}, taskName=${task.taskName}, toAgentId=${task.toAgentId}`);
    return task;
  }

  /**
   * 更新任务拆解状态
   */
  static async updateTaskSplitStatus(
    taskId: string,
    splitStatus: 'not_split' | 'pending_split' | 'split_pending_review' | 'split_confirmed' | 'split_rejected' | 'in_execution' | 'completed',
    extraFields?: Partial<AgentTask>
  ): Promise<AgentTask | null> {
    const updates: any = {
      splitStatus,
      updatedAt: new Date(),
    };

    if (extraFields) {
      Object.assign(updates, extraFields);
    }

    const [task] = await db
      .update(agentTasks)
      .set(updates)
      .where(eq(agentTasks.taskId, taskId))
      .returning();

    if (task) {
      console.log(`✅ 任务拆解状态已更新: taskId=${taskId}, splitStatus=${splitStatus}`);
    }

    return task;
  }

  /**
   * 获取待拆解任务（Agent B 查询）
   */
  static async getPendingSplitTasks(agentId: string): Promise<AgentTask[]> {
    const tasks = await db
      .select()
      .from(agentTasks)
      .where(
        and(
          eq(agentTasks.toAgentId, agentId),
          eq(agentTasks.splitStatus, 'pending_split')
        )
      )
      .orderBy(desc(agentTasks.createdAt));

    return tasks;
  }

  /**
   * 获取待审核拆解任务（Agent A 查询）
   */
  static async getPendingReviewTasks(agentId: string): Promise<AgentTask[]> {
    const tasks = await db
      .select()
      .from(agentTasks)
      .where(
        and(
          eq(agentTasks.fromAgentId, agentId),
          eq(agentTasks.splitStatus, 'split_pending_review')
        )
      )
      .orderBy(desc(agentTasks.createdAt));

    return tasks;
  }

  /**
   * 根据拆解状态查询任务
   */
  static async getTasksBySplitStatus(
    agentId: string,
    splitStatus: string
  ): Promise<AgentTask[]> {
    const tasks = await db
      .select()
      .from(agentTasks)
      .where(
        and(
          eq(agentTasks.toAgentId, agentId),
          eq(agentTasks.splitStatus, splitStatus as any)
        )
      )
      .orderBy(desc(agentTasks.createdAt));

    return tasks;
  }

  /**
   * 获取任务验收标准
   */
  static async getAcceptanceCriteria(taskId: string): Promise<string | null> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }
    // 优先从新字段读取，如果没有则从 metadata 中读取
    return task.acceptanceCriteria || task.metadata?.acceptanceCriteria || null;
  }
}

export default TaskManager;
