/**
 * Agent B 统一拆分器
 * 
 * 功能：
 * 1. 统一处理所有 executor 的任务拆分（不再区分 insurance-d、insurance-c 等）
 * 2. 用 Agent B 的身份去拆分 daily_task → agent_sub_tasks
 * 3. 复用现有的拆分逻辑
 */

import { BaseSplitter } from './base-splitter';
import { db } from '@/lib/db';
import { dailyTask, agentSubTasks, agentNotifications } from '@/lib/db/schema';
import { eq, and, or, lte, inArray, sql } from 'drizzle-orm';
import { splitTaskForAgent } from '@/lib/agent-llm';
import { createNotification } from '@/lib/services/notification-service-v3';
import { randomUUID } from 'crypto';

export class AgentBUnifiedSplitter extends BaseSplitter {
  agentId = 'B';
  timeoutMinutes = 120; // 2小时超时

  /**
   * 重写获取可执行任务的方法：不限制 executor
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

    console.log(`🔍 [${this.agentId}] 查询可执行任务（统一处理所有 executor）...`);
    console.log(`📅 [${this.agentId}] 今天日期（北京时间）: ${today}`);
    console.log(`⏰ [${this.agentId}] 超时时间: ${this.timeoutMinutes} 分钟`);

    // 先查询所有 pending_review 状态的任务（等待拆分的新任务）
    // 🔥 兼容两种格式：pending_review（下划线）和 pending-review（短横线）
    // 🔥 关键：不限制 executor，处理所有 executor 的任务
    const pendingTasks = await db
      .select()
      .from(dailyTask)
      .where(
        and(
          or(
            eq(dailyTask.executionStatus, 'pending_review'),
            eq(dailyTask.executionStatus, 'pending-review')
          ),
          eq(dailyTask.questionStatus, 'resolved'),
          lte(dailyTask.executionDate, today)
        )
      );

    // 直接查询超时的 splitting 任务（用于超时重试）
    const timedOutTasks = await db
      .select()
      .from(dailyTask)
      .where(
        and(
          eq(dailyTask.executionStatus, 'splitting'),
          lte(dailyTask.executionDate, today),
          lte(dailyTask.splitStartTime, timeoutAgo)
        )
      );

    const tasks = [...pendingTasks, ...timedOutTasks];

    // 🔥 过滤掉已有子任务的任务（双重保险）
    const tasksWithoutSubTasks = [];
    for (const task of tasks) {
      try {
        const subTaskResult = await db
          .select({ count: sql`count(*)` })
          .from(agentSubTasks)
          .where(eq(agentSubTasks.commandResultId, task.id));
        
        if (Number(subTaskResult[0].count) === 0) {
          tasksWithoutSubTasks.push(task);
        } else {
          console.log(`⏭️ [${this.agentId}] 任务 ${task.taskId} 已有 ${subTaskResult[0].count} 个子任务，跳过`);
        }
      } catch (error) {
        console.warn(`⚠️ [${this.agentId}] 检查任务 ${task.taskId} 子任务失败，仍然加入:`, error);
        tasksWithoutSubTasks.push(task);
      }
    }

    console.log(`📋 [${this.agentId}] 找到 ${tasksWithoutSubTasks.length} 个可执行任务（过滤掉 ${tasks.length - tasksWithoutSubTasks.length} 个已有子任务的任务）`);
    return tasksWithoutSubTasks;
  }

  /**
   * 执行统一拆分
   */
  async executeSplit(taskIds: string[]): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    console.log(`🔧 [${this.agentId}] 开始统一拆分 ${taskIds.length} 个任务`);
    console.log(`📋 [${this.agentId}] 任务 IDs:`, taskIds);
    
    try {
      // 查询所有任务详情
      const tasks = await db
        .select()
        .from(dailyTask)
        .where(inArray(dailyTask.id, taskIds));

      if (tasks.length === 0) {
        throw new Error(`未找到任何任务`);
      }

      console.log(`📦 [${this.agentId}] 找到 ${tasks.length} 个任务`);

      // 按 executionDate 和 taskPriority 排序（保持原有的顺序）
      const sortedTasks = [...tasks].sort((a, b) => {
        // 先按执行日期排序
        if (a.executionDate && b.executionDate) {
          const dateA = new Date(a.executionDate.toString());
          const dateB = new Date(b.executionDate.toString());
          if (dateA.getTime() !== dateB.getTime()) {
            return dateA.getTime() - dateB.getTime();
          }
        }
        // 再按优先级排序
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        const priorityA = priorityOrder[a.taskPriority as keyof typeof priorityOrder] || 1;
        const priorityB = priorityOrder[b.taskPriority as keyof typeof priorityOrder] || 1;
        return priorityA - priorityB;
      });

      console.log(`🔀 [${this.agentId}] 任务已按执行日期和优先级排序`);

      // 处理每个任务
      const allGroupResults: any[] = [];
      let totalSubTaskCount = 0;

      for (const task of sortedTasks) {
        console.log(`🔄 [${this.agentId}] 处理任务: ${task.taskId} (executor: ${task.executor})`);

        try {
          // 检查是否被拒绝
          const isRejected = task.metadata?.splitRejected === true;
          
          // 如果被拒绝了，先清除之前的子任务数据
          if (isRejected) {
            console.log(`🔄 [${this.agentId}] 任务 ${task.id} 已被拒绝，清除之前的子任务数据`);
            await db
              .delete(agentSubTasks)
              .where(eq(agentSubTasks.commandResultId, task.id));
            await db
              .update(dailyTask)
              .set({
                subTaskCount: 0,
                completedSubTasks: 0,
                metadata: {
                  ...(task.metadata || {}),
                  splitRejected: false,
                  rejectionReason: null,
                },
              })
              .where(eq(dailyTask.id, task.id));
          }

          // 标记任务为拆解中
          await this.markAsSplitting(task.id);

          // 调用 Agent B 进行拆分（用 Agent B 的身份）
          console.log(`🤖 [${this.agentId}] 调用 splitTaskForAgent 拆解任务...`);
          const splitResult = await splitTaskForAgent('B', task);
          const subTasks = splitResult.subTasks;
          const productTags = splitResult.productTags;
          console.log(`✅ [${this.agentId}] 拆解完成，子任务数量: ${subTasks.length}，产品标签: ${productTags.join(', ')}`);

          // 构建统一的拆解结果格式
          const splitResultData = {
            productTags: productTags, // 🔥 新增：产品标签
            subTasks: subTasks.map((st, index) => ({
              taskTitle: st.title,
              title: st.title,
              description: st.description,
              commandContent: st.description,
              executor: st.executor,
              priority: st.priority || '中',
              deadline: st.deadline || task.executionDate?.toString() || new Date().toISOString().split('T')[0],
              estimatedHours: st.estimatedHours || 2,
              acceptanceCriteria: st.acceptanceCriteria,
              isCritical: st.isCritical,
              criticalReason: st.criticalReason,
              orderIndex: index + 1,
            })),
            summary: `Agent B 统一拆解任务: ${task.taskTitle}`,
            totalDeliverables: subTasks.length.toString(),
            timeFrame: `${subTasks.length}步`,
          };

          // 创建通知给 Agent A
          console.log(`📢 [${this.agentId}] 创建通知给 Agent A: 拆解完成`);
          
          const splitResultString = JSON.stringify(splitResultData);
          
          await createNotification({
            agentId: 'A',
            type: 'agent_b_split_result',
            title: `Agent B 统一拆解完成: ${task.taskTitle}`,
            content: {
              fromAgentId: 'B',
              toAgentId: 'A',
              message: '拆解完成，请确认拆解方案',
              splitResult: splitResultData,
              productTags: productTags, // 🔥 新增：产品标签
            },
            result: splitResultString,
            relatedTaskId: task.id,
            fromAgentId: 'B',
            priority: 'high',
            metadata: {
              dailyTaskId: task.id,
              originalTaskTitle: task.taskTitle || '',
              originalExecutor: task.executor, // 记录原始 executor
            },
          });

          console.log(`✅ [${this.agentId}] 通知已创建: B → A`);

          // 拆分完成后，修改状态为 pending_confirmation
          await this.markAsPendingConfirmation(task.id);
          console.log(`✅ [${this.agentId}] 任务 ${task.taskId} 状态已更新为 pending_confirmation`);

          allGroupResults.push({
            taskId: task.taskId,
            taskTitle: task.taskTitle,
            executor: task.executor,
            subTaskCount: subTasks.length,
          });
          
          totalSubTaskCount += subTasks.length;

        } catch (taskError) {
          console.error(`❌ [${this.agentId}] 处理任务 ${task.taskId} 失败:`, taskError);
          // 单个任务失败不影响其他任务
        }
      }

      return {
        success: true,
        message: `Agent B 统一拆解完成，处理 ${allGroupResults.length} 个任务，共 ${totalSubTaskCount} 个子任务`,
        data: {
          groupResults: allGroupResults,
          totalTaskCount: allGroupResults.length,
          totalSubTaskCount: totalSubTaskCount,
        },
      };
      
    } catch (error) {
      console.error(`❌ [${this.agentId}] 统一拆解失败:`, error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
