/**
 * POST /api/cron/monitor-subtasks-timeout
 * 定时任务：监控 agent_sub_tasks 执行超时
 *
 * 功能：
 * 1. 查询执行超过 15 分钟的任务
 * 2. 通知 insurance-d 反馈问题
 * 3. 通知 agent B 处理
 * 4. 记录处理历史（最多 5 轮）
 *
 * 调用方式：
 * - 每 5 分钟自动执行一次
 * - 或手动触发执行
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, dailyTask } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { createNotification } from '@/lib/services/notification-service';

// 配置参数
const TIMEOUT_MINUTES = 15; // 超时阈值（分钟）
const MAX_HANDLING_COUNT = 5; // 最大处理次数
const MAX_TIMEOUT_TASKS = 5; // 每次最多处理 5 个超时任务

/**
 * POST /api/cron/monitor-subtasks-timeout
 * 监控 agent_sub_tasks 执行超时
 */
export async function POST(request: NextRequest) {
  console.log('🔄 [monitor-subtasks-timeout] 开始监控超时任务...');

  try {
    // Step 1: 查询超时的 agent_sub_tasks
    // 条件：
    // 1. status = 'in_progress'
    // 2. dispatched_at IS NOT NULL
    // 3. (NOW() - dispatched_at) > 15 分钟
    const allTimeoutTasks = await db
      .select()
      .from(agentSubTasks)
      .where(
        and(
          eq(agentSubTasks.status, 'in_progress'),
          isNotNull(agentSubTasks.dispatchedAt)
        )
      );

    // 在内存中过滤出超时的任务
    const now = new Date();
    const timeoutTasks = allTimeoutTasks.filter(task => {
      if (!task.dispatchedAt) return false;

      const elapsedMinutes = (now.getTime() - task.dispatchedAt.getTime()) / (1000 * 60);
      return elapsedMinutes > TIMEOUT_MINUTES;
    });

    console.log(`📋 找到 ${timeoutTasks.length} 个超时任务`);

    if (timeoutTasks.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有超时任务',
        processedCount: 0,
      });
    }

    // 最多处理 5 个超时任务
    const tasksToProcess = timeoutTasks.slice(0, MAX_TIMEOUT_TASKS);
    console.log(`📊 处理前 ${tasksToProcess.length} 个超时任务`);

    let processedCount = 0;
    let handledCount = 0;
    let escalatedCount = 0;
    const results = [];

    // Step 2: 逐个处理超时任务
    for (const task of tasksToProcess) {
      console.log(`\n⏰ 处理超时任务: ${task.taskTitle}`);
      console.log(`  📊 已执行: ${(now.getTime() - task.dispatchedAt!.getTime()) / (1000 * 60).toFixed(1)} 分钟`);
      console.log(`  🔄 处理次数: ${task.timeoutHandlingCount}/${MAX_HANDLING_COUNT}`);

      try {
        const handlingCount = task.timeoutHandlingCount || 0;

        if (handlingCount < MAX_HANDLING_COUNT) {
          // 处理次数 < 5：通知 insurance-d 和 agent B
          await handleTimeoutTask(task, handlingCount + 1);
          handledCount++;
          results.push({
            taskId: task.id,
            taskTitle: task.taskTitle,
            status: 'handled',
            handlingCount: handlingCount + 1,
          });
        } else {
          // 处理次数 >= 5：标记为 escalated（将由下一个 API 处理）
          await escalateTask(task);
          escalatedCount++;
          results.push({
            taskId: task.id,
            taskTitle: task.taskTitle,
            status: 'escalated',
          });
        }

        processedCount++;
      } catch (error) {
        console.error(`  ❌ 处理失败:`, error);
        results.push({
          taskId: task.id,
          taskTitle: task.taskTitle,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log(`\n✅ 处理完成: 处理 ${handledCount} 个，上报 ${escalatedCount} 个`);

    return NextResponse.json({
      success: true,
      message: `处理完成: 处理 ${handledCount} 个，上报 ${escalatedCount} 个`,
      processedCount,
      handledCount,
      escalatedCount,
      results,
    });
  } catch (error) {
    console.error('❌ 监控超时失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * 处理超时任务（通知 insurance-d 和 agent B）
 */
async function handleTimeoutTask(task: any, handlingCount: number) {
  console.log(`  📝 通知 insurance-d 和 agent B 处理超时任务（第 ${handlingCount} 次）`);

  // 1. 更新 feedback_history
  const feedbackHistory = task.feedbackHistory || [];
  feedbackHistory.push({
    feedbackTime: new Date().toISOString(),
    feedbackBy: 'system',
    feedbackContent: `任务执行超时（已执行 ${TIMEOUT_MINUTES}+ 分钟）`,
    handledBy: 'pending',
    handlingResult: '等待 insurance-d 和 agent B 处理',
  });

  // 2. 通知 insurance-d 反馈问题
  await createNotification({
    agentId: 'insurance-d',
    type: 'subtask_timeout',
    taskId: task.id,
    relatedTaskId: task.commandResultId,
    title: `子任务执行超时`,
    content: {
      taskTitle: task.taskTitle,
      taskDescription: task.taskDescription,
      executor: task.agentId,
      dispatchedAt: task.dispatchedAt,
      timeoutMinutes: TIMEOUT_MINUTES,
      handlingCount,
    },
    metadata: {
      subTaskId: task.id,
      commandResultId: task.commandResultId,
      feedbackHistory,
    },
  });

  console.log(`  ✅ 已通知 insurance-d`);

  // 3. 通知 agent B 处理
  await createNotification({
    agentId: 'B',
    type: 'subtask_timeout',
    taskId: task.id,
    relatedTaskId: task.commandResultId,
    title: `子任务执行超时 - 需要 agent B 介入`,
    content: {
      taskTitle: task.taskTitle,
      taskDescription: task.taskDescription,
      executor: task.agentId,
      dispatchedAt: task.dispatchedAt,
      timeoutMinutes: TIMEOUT_MINUTES,
      handlingCount,
    },
    metadata: {
      subTaskId: task.id,
      commandResultId: task.commandResultId,
      feedbackHistory,
    },
  });

  console.log(`  ✅ 已通知 agent B`);

  // 4. 更新 agent_sub_tasks 状态
  await db
    .update(agentSubTasks)
    .set({
      status: 'timeout',
      timeoutHandlingCount: handlingCount,
      feedbackHistory: feedbackHistory,
      lastFeedbackAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(agentSubTasks.id, task.id));

  console.log(`  ✅ 任务已标记为 timeout，处理次数: ${handlingCount}`);
}

/**
 * 上报任务（标记为 escalated）
 */
async function escalateTask(task: any) {
  console.log(`  ⬆️ 任务已处理 ${MAX_HANDLING_COUNT} 次，标记为 escalated`);

  await db
    .update(agentSubTasks)
    .set({
      status: 'escalated',
      escalated: true,
      escalatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(agentSubTasks.id, task.id));

  console.log(`  ✅ 任务已标记为 escalated`);
}

/**
 * GET /api/cron/monitor-subtasks-timeout
 * 获取定时任务说明（可选）
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'agent_sub_tasks 超时监控定时任务 API',
    description: '监控 agent_sub_tasks 执行超时，通知 insurance-d 和 agent B 处理',
    config: {
      timeoutMinutes: TIMEOUT_MINUTES,
      maxHandlingCount: MAX_HANDLING_COUNT,
      maxTimeoutTasks: MAX_TIMEOUT_TASKS,
      schedule: '每 5 分钟执行一次',
    },
    queryConditions: {
      status: '= in_progress',
      dispatchedAt: 'IS NOT NULL',
      timeout: '> 15 分钟',
    },
    workflow: [
      '1. 查询执行超过 15 分钟的任务',
      '2. 检查处理次数',
      '3. 如果 < 5：通知 insurance-d 和 agent B',
      '4. 如果 >= 5：标记为 escalated',
    ],
  });
}
