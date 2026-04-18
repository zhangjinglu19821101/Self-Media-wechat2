/**
 * TS 定时任务调度器
 * 每 10 分钟检查一次，对超过 1 小时无进展的指令，让执行 agent 描述问题
 */

import { db } from '@/lib/db';
import { dailyTask } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { TaskStateMachine, CommandStatus } from './task-state-machine';

/**
 * TS 定时任务调度器类
 */
export class TSScheduler {
  private static isRunning = false;
  private static timer: NodeJS.Timeout | null = null;

  /**
   * 启动定时任务
   */
  static start() {
    if (this.isRunning) {
      console.log('TS 定时任务已在运行中');
      return;
    }

    this.isRunning = true;
    console.log('TS 定时任务已启动（每 10 分钟检查一次）');

    // 立即执行一次
    this.checkCommands();

    // 每 10 分钟执行一次
    this.timer = setInterval(() => {
      this.checkCommands();
    }, 10 * 60 * 1000); // 10 分钟
  }

  /**
   * 停止定时任务
   */
  static stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('TS 定时任务已停止');
  }

  /**
   * 检查所有执行中的指令
   */
  private static async checkCommands() {
    console.log(`[${new Date().toISOString()}] 开始检查执行中的指令...`);

    try {
      // 1. 查询所有执行中的指令
      const executingCommands = await db
        .select()
        .from(dailyTask)
        .where(eq(dailyTask.executionStatus, CommandStatus.IN_PROGRESS));

      console.log(`找到 ${executingCommands.length} 条执行中的指令`);

      // 2. 遍历每条指令
      for (const command of executingCommands) {
        const { commandId, executor, commandContent, updatedAt } = command;

        // 3. 判断：updateTime 距离现在是否超过 1 小时
        const lastUpdateTime = new Date(updatedAt);
        const hoursSinceUpdate = (Date.now() - lastUpdateTime.getTime()) / (1000 * 60 * 60);

        if (hoursSinceUpdate >= 1) {
          console.log(`指令 ${commandId} 超过 1 小时无进展，通知执行 agent 描述问题`);

          // 4. 通知执行 agent 描述问题
          await this.notifyExecutorToDescribeProblem(command);
        }
      }

      console.log(`[${new Date().toISOString()}] 检查完成`);
    } catch (error) {
      console.error('TS 定时任务执行失败:', error);
    }
  }

  /**
   * 通知执行 agent 描述问题
   */
  private static async notifyExecutorToDescribeProblem(command: any) {
    const { commandId, executor, commandContent } = command;

    // 1. 发送通知
    const notification = await TaskStateMachine.notifyAgent(
      'TS',
      executor,
      'system',
      `指令超时提醒`,
      `指令「${commandContent}」已超过 1 小时无进展，请描述遇到的问题。`,
      commandId
    );

    console.log(`已发送通知给 ${executor}，通知ID：${notification.notificationId}`);

    // 2. 记录 TS 检查时间
    await db
      .update(dailyTask)
      .set({
        lastTsCheckTime: new Date(),
        updatedAt: new Date()
      })
      .where(eq(dailyTask.commandId, commandId));

    // 3. 等待执行 agent 描述问题（模拟）
    // TODO: 实际实现中，这里需要等待执行 agent 的回复
    // 可以通过 WebSocket 或者轮询来获取回复

    // 4. 如果超时未回复，标记为异常
    // await this.handleTimeout(command);
  }

  /**
   * 处理超时未回复的情况
   */
  private static async handleTimeout(command: any, timeoutMinutes: number = 30) {
    const { commandId, executor } = command;

    console.log(`指令 ${commandId} TS 提醒后 ${timeoutMinutes} 分钟内未回复`);

    // 1. 记录唤醒
    await TaskStateMachine.recordAwakening(
      commandId,
      'ts',
      `TS 提醒后 ${timeoutMinutes} 分钟内未回复`
    );

    // 2. 通知 Agent B
    await TaskStateMachine.notifyAgent(
      'TS',
      'agent B',
      'system',
      `指令超时未回复`,
      `指令 ${commandId} 执行主体 ${executor} 在 TS 提醒后 ${timeoutMinutes} 分钟内未回复，请协助处理`,
      commandId
    );
  }

  /**
   * 接收执行 agent 的问题描述
   */
  static async receiveProblemDescription(
    commandId: string,
    problemDescription: {
      currentStatus: string;
      specificProblem: string;
      blocker: string;
      neededHelp: string;
      estimatedTimeToResolve: string;
    }
  ) {
    console.log(`收到指令 ${commandId} 的问题描述：`, problemDescription);

    // 1. 更新 helpRecord
    const [command] = await db
      .select()
      .from(dailyTask)
      .where(eq(dailyTask.commandId, commandId));

    if (!command) {
      throw new Error(`指令 ${commandId} 不存在`);
    }

    const helpRecord = `${new Date().toISOString()} - TS 唤起：超过 1 小时无进展，问题描述：${JSON.stringify(problemDescription)}`;

    await db
      .update(dailyTask)
      .set({
        helpRecord: `${command.helpRecord || ''}\n${helpRecord}`.trim(),
        lastConsultTime: new Date(),
        updatedAt: new Date()
      })
      .where(eq(dailyTask.commandId, commandId));

    // 2. 转交给 Agent B
    await this.submitProblemToAgentB(command, problemDescription);

    return { success: true, message: '问题描述已提交给 Agent B' };
  }

  /**
   * 提交问题给 Agent B
   */
  private static async submitProblemToAgentB(command: any, problemDescription: any) {
    const { commandId, executor, commandContent } = command;

    // 1. 通知 Agent B
    await TaskStateMachine.notifyAgent(
      'TS',
      'agent B',
      'system',
      `收到问题：${problemDescription.specificProblem}`,
      `指令「${commandContent}」执行主体 ${executor} 描述的问题：${JSON.stringify(problemDescription)}`,
      commandId
    );

    console.log(`已将问题转交给 Agent B`);

    // 2. 记录 TS 唤起
    await TaskStateMachine.recordAwakening(
      commandId,
      'ts',
      `TS 转交问题：${problemDescription.specificProblem}`
    );
  }
}
