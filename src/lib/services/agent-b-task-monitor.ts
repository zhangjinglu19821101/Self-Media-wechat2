/**
 * Agent B 任务监控服务
 * Agent B 定期主动查询待拆解的任务，并自动拆解
 */

import { db } from '@/lib/db';
import { agentTasks, agentNotifications } from '@/lib/db/schema';
import { TaskStateMachine, TaskStatusConst } from './task-state-machine';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * Agent B 任务监控服务类
 */
export class AgentBTaskMonitor {
  private static isRunning = false;
  private static timer: NodeJS.Timeout | null = null;

  /**
   * 启动任务监控
   */
  static start(pollInterval: number = 5 * 60 * 1000) { // 默认 5 分钟轮询一次
    if (this.isRunning) {
      console.log('Agent B 任务监控已在运行中');
      return;
    }

    this.isRunning = true;
    console.log('Agent B 任务监控已启动（每 5 分钟检查一次）');

    // 立即执行一次
    this.checkPendingTasks();

    // 定时轮询
    this.timer = setInterval(() => {
      this.checkPendingTasks();
    }, pollInterval);
  }

  /**
   * 停止任务监控
   */
  static stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('Agent B 任务监控已停止');
  }

  /**
   * 检查待拆解的任务
   */
  private static async checkPendingTasks() {
    console.log(`[${new Date().toISOString()}] Agent B 开始检查待拆解任务...`);

    try {
      // 1. 查询所有 taskStatus = "未拆分" 的任务
      const pendingTasks = await db
        .select()
        .from(agentTasks)
        .where(eq(agentTasks.taskStatus, TaskStatusConst.UNSPLIT));

      console.log(`找到 ${pendingTasks.length} 个待拆解任务`);

      // 2. 遍历每个任务，开始拆解
      for (const task of pendingTasks) {
        await this.startSplitting(task);
      }

      console.log(`[${new Date().toISOString()}] 待拆解任务检查完成`);
    } catch (error) {
      console.error('Agent B 任务监控失败:', error);
    }
  }

  /**
   * 开始拆解任务
   */
  private static async startSplitting(task: any) {
    const { taskId, taskName, coreCommand, taskDurationStart, taskDurationEnd, totalDeliverables } = task;

    console.log(`Agent B 开始拆解任务：${taskName}（${taskId}）`);

    // 1. 更新任务状态为"拆分中"
    await TaskStateMachine.updateTaskStatus(
      taskId,
      TaskStatus.SPLITTING,
      'agent B',
      '开始拆解任务'
    );

    // 2. 标记通知为已读
    await db
      .update(agentNotifications)
      .set({
        isRead: true,
        status: 'read',
        readAt: new Date()
      })
      .where(
        and(
          eq(agentNotifications.relatedTaskId, taskId),
          eq(agentNotifications.toAgentId, 'agent B'),
          isNull(agentNotifications.readAt)
        )
      );

    // 3. 拆解任务（这里需要调用 LLM 进行拆解）
    // TODO: 实现实际的拆解逻辑
    const splitCommands = await this.splitTaskWithAI(task);

    // 4. 保存拆解结果（草稿，不入库）
    // TODO: 将拆解结果保存到临时存储或前端
    console.log(`任务 ${taskName} 拆解完成，共 ${splitCommands.length} 条指令`);
    console.log('拆解结果：', splitCommands);

    // 5. 通知 Agent A 确认拆解方案
    await TaskStateMachine.notifyAgent(
      'agent B',
      'agent A',
      'system',
      `任务拆解完成，请确认`,
      `任务「${taskName}」已拆解为 ${splitCommands.length} 条指令，请确认是否入库。`,
      taskId
    );

    return {
      taskId,
      splitCommands
    };
  }

  /**
   * 使用 AI 拆解任务
   * 这里需要调用 LLM 进行智能拆解
   */
  private static async splitTaskWithAI(task: any) {
    const { taskName, coreCommand, taskDurationStart, taskDurationEnd, totalDeliverables } = task;

    // TODO: 实际实现中，这里需要调用 LLM 进行拆解
    // 示例拆解逻辑：
    const splitCommands = [
      {
        commandContent: `收集并分析任务需求，理解「${taskName}」的具体要求`,
        executor: task.executor,
        commandPriority: task.taskPriority,
        executionDeadlineStart: new Date(taskDurationStart),
        executionDeadlineEnd: new Date(new Date(taskDurationStart).getTime() + 24 * 60 * 60 * 1000),
        deliverables: '需求分析报告1份'
      },
      {
        commandContent: `根据需求分析，执行核心指令：${coreCommand}`,
        executor: task.executor,
        commandPriority: task.taskPriority,
        executionDeadlineStart: new Date(new Date(taskDurationStart).getTime() + 24 * 60 * 60 * 1000),
        executionDeadlineEnd: new Date(new Date(taskDurationStart).getTime() + 72 * 60 * 60 * 1000),
        deliverables: '核心产出物1份'
      },
      {
        commandContent: `完成总交付物：${totalDeliverables}`,
        executor: task.executor,
        commandPriority: task.taskPriority,
        executionDeadlineStart: new Date(new Date(taskDurationStart).getTime() + 72 * 60 * 60 * 1000),
        executionDeadlineEnd: new Date(taskDurationEnd),
        deliverables: totalDeliverables
      }
    ];

    return splitCommands;
  }

  /**
   * 获取待拆解任务列表（提供给前端使用）
   */
  static async getPendingTasks() {
    const pendingTasks = await db
      .select()
      .from(agentTasks)
      .where(eq(agentTasks.taskStatus, TaskStatusConst.UNSPLIT));

    return pendingTasks;
  }

  /**
   * 获取拆解中任务列表（提供给前端使用）
   */
  static async getSplittingTasks() {
    const splittingTasks = await db
      .select()
      .from(agentTasks)
      .where(eq(agentTasks.taskStatus, TaskStatus.SPLITTING));

    return splittingTasks;
  }

  /**
   * 获取待确认拆解方案的任务列表（提供给前端使用）
   */
  static async getPendingConfirmationTasks() {
    const pendingConfirmationTasks = await db
      .select()
      .from(agentTasks)
      .where(eq(agentTasks.taskStatus, TaskStatus.SPLIT_COMPLETED));

    return pendingConfirmationTasks;
  }
}
