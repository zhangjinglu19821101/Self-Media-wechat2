/**
 * Agent B 巡检服务
 * 每日 13:00 检查执行超过 24 小时的指令，主动询问是否遇到困难
 */

import { db } from '@/lib/db';
import { dailyTask } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { TaskStateMachine, CommandStatus } from './task-state-machine';

/**
 * Agent B 巡检服务类
 */
export class AgentBInspector {
  private static isRunning = false;
  private static timer: NodeJS.Timeout | null = null;

  /**
   * 启动巡检任务
   */
  static start() {
    if (this.isRunning) {
      console.log('Agent B 巡检任务已在运行中');
      return;
    }

    this.isRunning = true;
    console.log('Agent B 巡检任务已启动（每日 13:00）');

    // 计算距离下次 13:00 的毫秒数
    this.scheduleNextInspection();
  }

  /**
   * 停止巡检任务
   */
  static stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('Agent B 巡检任务已停止');
  }

  /**
   * 调度下次巡检
   */
  private static scheduleNextInspection() {
    const now = new Date();
    const next13 = new Date();
    next13.setHours(13, 0, 0, 0);

    // 如果今天的 13:00 已过，则调度到明天的 13:00
    if (now > next13) {
      next13.setDate(next13.getDate() + 1);
    }

    const delay = next13.getTime() - now.getTime();
    console.log(`下次巡检时间：${next13.toISOString()}（${Math.floor(delay / 1000 / 60)} 分钟后）`);

    // 设置定时器
    this.timer = setTimeout(() => {
      this.inspect();
      // 巡检完成后，调度下一次（24 小时后）
      this.scheduleNextInspection();
    }, delay);
  }

  /**
   * 执行巡检
   */
  private static async inspect() {
    console.log(`[${new Date().toISOString()}] Agent B 开始巡检...`);

    try {
      // 1. 查询所有执行中的指令
      const executingCommands = await db
        .select()
        .from(dailyTask)
        .where(eq(dailyTask.executionStatus, CommandStatus.IN_PROGRESS));

      console.log(`找到 ${executingCommands.length} 条执行中的指令`);

      // 2. 遍历每条指令
      for (const command of executingCommands) {
        const { commandId, executor, commandContent, createdAt } = command;

        // 3. 判断：指令创建时间是否超过 24 小时
        const createdTime = new Date(createdAt);
        const hoursSinceCreation = (Date.now() - createdTime.getTime()) / (1000 * 60 * 60);

        if (hoursSinceCreation >= 24) {
          console.log(`指令 ${commandId} 执行超过 24 小时，主动咨询执行主体`);

          // 4. 主动咨询执行主体
          await this.consultExecutor(command);
        }
      }

      console.log(`[${new Date().toISOString()}] 巡检完成`);
    } catch (error) {
      console.error('Agent B 巡检失败:', error);
    }
  }

  /**
   * 主动咨询执行主体
   */
  private static async consultExecutor(command: any) {
    const { commandId, executor, commandContent } = command;

    // 1. 发送通知
    const notification = await TaskStateMachine.notifyAgent(
      'agent B',
      executor,
      'system',
      `巡检咨询`,
      `指令「${commandContent}」已执行超过 24 小时，是否遇到困难？`,
      commandId
    );

    console.log(`已发送巡检通知给 ${executor}，通知ID：${notification.notificationId}`);

    // 2. 记录巡检时间
    await db
      .update(dailyTask)
      .set({
        lastInspectionTime: new Date(),
        updatedAt: new Date()
      })
      .where(eq(dailyTask.commandId, commandId));

    // 3. 等待执行主体回复（模拟）
    // TODO: 实际实现中，这里需要等待执行主体的回复

    // 4. 如果超时未回复，唤起 Agent B 处理
    // await this.handleTimeout(command);
  }

  /**
   * 处理超时未回复的情况
   */
  private static async handleTimeout(command: any, timeoutMinutes: number = 30) {
    const { commandId, executor } = command;

    console.log(`指令 ${commandId} 巡检后 ${timeoutMinutes} 分钟内未回复`);

    // 1. 记录唤醒
    await TaskStateMachine.recordAwakening(
      commandId,
      'agent_b',
      `巡检咨询后 ${timeoutMinutes} 分钟内未回复`
    );

    // 2. 唤起 Agent B 处理
    await this.triggerAgentB(command, '巡检超时无回复');
  }

  /**
   * 唤起 Agent B 处理
   */
  private static async triggerAgentB(command: any, reason: string) {
    const { commandId, executor, commandContent } = command;

    console.log(`Agent B 唤起处理指令 ${commandId}，原因：${reason}`);

    // 1. 记录到 helpRecord
    const [currentCommand] = await db
      .select()
      .from(dailyTask)
      .where(eq(dailyTask.commandId, commandId));

    if (currentCommand) {
      const helpRecord = `${new Date().toISOString()} - Agent B 唤起：${reason}`;

      await db
        .update(dailyTask)
        .set({
          helpRecord: `${currentCommand.helpRecord || ''}\n${helpRecord}`.trim(),
          updatedAt: new Date()
        })
        .where(eq(dailyTask.commandId, commandId));
    }

    // 2. 通知 Agent B 自我处理
    await TaskStateMachine.notifyAgent(
      'system',
      'agent B',
      'system',
      `唤起处理`,
      `指令 ${commandId} 执行主体 ${executor} 巡检超时，请主动了解情况并协助解决`,
      commandId
    );
  }

  /**
   * 接收执行主体的巡检回复
   */
  static async receiveInspectionResponse(
    commandId: string,
    response: string
  ) {
    console.log(`收到指令 ${commandId} 的巡检回复：${response}`);

    // 1. 更新 helpRecord
    const [command] = await db
      .select()
      .from(dailyTask)
      .where(eq(dailyTask.commandId, commandId));

    if (!command) {
      throw new Error(`指令 ${commandId} 不存在`);
    }

    const helpRecord = `${new Date().toISOString()} - 巡检回复：${response}`;

    await db
      .update(dailyTask)
      .set({
        helpRecord: `${command.helpRecord || ''}\n${helpRecord}`.trim(),
        updatedAt: new Date()
      })
      .where(eq(dailyTask.commandId, commandId));

    // 2. 判断是否需要进入咨询流程
    if (response.includes('困难') || response.includes('问题') || response.includes('阻塞')) {
      console.log(`执行主体遇到困难，进入咨询流程`);
      await this.handleDifficulty(command, response);
    }

    return { success: true, message: '巡检回复已记录' };
  }

  /**
   * 处理执行主体遇到的困难
   */
  private static async handleDifficulty(command: any, response: string) {
    const { commandId } = command;

    // 1. 记录到 helpRecord
    const helpRecord = `${new Date().toISOString()} - 巡检发现问题：${response}`;

    await db
      .update(dailyTask)
      .set({
        helpRecord: db.raw(`COALESCE(help_record, '') || '\n${helpRecord}'`),
        updatedAt: new Date()
      })
      .where(eq(dailyTask.commandId, commandId));

    // 2. 通知 Agent B 处理
    await TaskStateMachine.notifyAgent(
      'system',
      'agent B',
      'system',
      `执行遇到困难`,
      `指令 ${commandId} 巡检发现问题：${response}`,
      commandId
    );

    console.log(`已通知 Agent B 处理困难`);
  }
}
