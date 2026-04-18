/**
 * 拆分器抽象基类
 * 所有 Agent 拆分器都继承此类
 */

import { db } from '@/lib/db';
import { dailyTask, agentSubTasks } from '@/lib/db/schema';
import { eq, and, or, lte, count, sql } from 'drizzle-orm';

export abstract class BaseSplitter {
  /** Agent ID */
  abstract agentId: string;
  
  /** 超时时间（分钟） */
  abstract timeoutMinutes: number;

  /**
   * 获取可执行的任务
   */
  async getTasksToProcess(): Promise<any[]> {
    const now = new Date();
    // ✅ 使用北京时间（Asia/Shanghai）计算今天日期
    const today = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    const timeoutAgo = new Date(now.getTime() - this.timeoutMinutes * 60 * 1000);

    console.log(`🔍 [${this.agentId}] 查询可执行任务...`);
    console.log(`📅 [${this.agentId}] 今天日期（北京时间）: ${today}`);
    console.log(`⏰ [${this.agentId}] 超时时间: ${this.timeoutMinutes} 分钟`);

    // 先查询所有 pending_review 状态的任务（等待拆分的新任务）
    // 🔥 兼容两种格式：pending_review（下划线）和 pending-review（短横线）
    const pendingTasks = await db
      .select()
      .from(dailyTask)
      .where(
        and(
          eq(dailyTask.executor, this.agentId),
          or(
            eq(dailyTask.executionStatus, 'pending_review'),
            eq(dailyTask.executionStatus, 'pending-review')
          ),
          eq(dailyTask.questionStatus, 'resolved'), // ✅ 确保 questionStatus 是 resolved
          lte(dailyTask.executionDate, today)
        )
      );

    // 直接查询超时的 splitting 任务（用于超时重试）
    const timedOutTasks = await db
      .select()
      .from(dailyTask)
      .where(
        and(
          eq(dailyTask.executor, this.agentId),
          eq(dailyTask.executionStatus, 'splitting'),
          lte(dailyTask.executionDate, today),
          lte(dailyTask.splitStartTime, timeoutAgo)
        )
      );

    const tasks = [...pendingTasks, ...timedOutTasks];

    // 🔥 新增：过滤掉已有子任务的任务（双重保险）
    const tasksWithoutSubTasks = [];
    for (const task of tasks) {
      try {
        const subTaskResult = await db
          .select({ count: count() })
          .from(agentSubTasks)
          .where(eq(agentSubTasks.commandResultId, task.id));
        
        if (subTaskResult[0].count === 0) {
          tasksWithoutSubTasks.push(task);
        } else {
          console.log(`⏭️ [${this.agentId}] 任务 ${task.taskId} 已有 ${subTaskResult[0].count} 个子任务，跳过`);
        }
      } catch (error) {
        // 如果查询失败，仍然加入（容错处理）
        console.warn(`⚠️ [${this.agentId}] 检查任务 ${task.taskId} 子任务失败，仍然加入:`, error);
        tasksWithoutSubTasks.push(task);
      }
    }

    console.log(`📋 [${this.agentId}] 找到 ${tasksWithoutSubTasks.length} 个可执行任务（过滤掉 ${tasks.length - tasksWithoutSubTasks.length} 个已有子任务的任务）`);
    return tasksWithoutSubTasks;
  }

  /**
   * 标记任务为拆解中
   */
  async markAsSplitting(taskId: string): Promise<void> {
    console.log(`🔒 [${this.agentId}] 标记任务 ${taskId} 为拆解中...`);
    
    await db
      .update(dailyTask)
      .set({
        executionStatus: 'splitting',
        splitStartTime: sql`now()`,
      })
      .where(eq(dailyTask.id, taskId));

    console.log(`✅ [${this.agentId}] 任务 ${taskId} 已标记为拆解中`);
  }

  /**
   * 标记任务为待确认（拆分完成后）
   */
  async markAsPendingConfirmation(taskId: string): Promise<void> {
    console.log(`✅ [${this.agentId}] 标记任务 ${taskId} 为待确认...`);
    
    await db
      .update(dailyTask)
      .set({
        executionStatus: 'pending_confirmation',
      })
      .where(eq(dailyTask.id, taskId));

    console.log(`✅ [${this.agentId}] 任务 ${taskId} 已标记为待确认`);
  }

  /**
   * 标记任务为已完成
   */
  async markAsCompleted(taskId: string): Promise<void> {
    console.log(`✅ [${this.agentId}] 标记任务 ${taskId} 为已完成...`);
    
    await db
      .update(dailyTask)
      .set({
        executionStatus: 'split_completed',
      })
      .where(eq(dailyTask.id, taskId));

    console.log(`✅ [${this.agentId}] 任务 ${taskId} 已标记为已完成`);
  }

  /**
   * 更新拆分开始时间（用于超时重试）
   */
  async updateSplitStartTime(taskId: string): Promise<void> {
    console.log(`🔄 [${this.agentId}] 更新任务 ${taskId} 的拆分开始时间...`);
    
    // 先查询当前任务的 metadata
    const task = await db
      .select()
      .from(dailyTask)
      .where(eq(dailyTask.id, taskId))
      .limit(1);
    
    if (task.length === 0) {
      console.error(`❌ [${this.agentId}] 任务 ${taskId} 不存在`);
      return;
    }
    
    const currentMetadata = task[0].metadata || {};
    const newMetadata = {
      ...currentMetadata,
      splitStartTime: new Date().toISOString(),
    };
    
    await db
      .update(dailyTask)
      .set({
        splitStartTime: sql`now()`, // 🔥 使用数据库当前时间，与 created_at 保持一致
        metadata: newMetadata,
      })
      .where(eq(dailyTask.id, taskId));

    console.log(`✅ [${this.agentId}] 任务 ${taskId} 的拆分开始时间已更新`);
  }

  /**
   * 执行拆分（子类实现）
   */
  abstract executeSplit(taskIds: string[]): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }>;
}
