
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, agentTasks, dailyTask } from '@/lib/db/schema';
import { eq, and, or, lte, desc } from 'drizzle-orm';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

export async function GET() {
  try {
    console.log('[Debug] 开始检查任务数据');

    // 1. 获取当前北京时间
    const now = getCurrentBeijingTime();
    const today = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    console.log('[Debug] 当前北京时间:', now.toISOString());
    console.log('[Debug] Today 字符串:', today);

    // 2. 查询最新的 agent_tasks
    const latestAgentTasks = await db
      .select()
      .from(agentTasks)
      .orderBy(desc(agentTasks.createdAt))
      .limit(10);

    console.log('[Debug] 找到', latestAgentTasks.length, '个 agent_tasks');

    // 3. 查询所有 agent_sub_tasks
    const allAgentSubTasks = await db
      .select()
      .from(agentSubTasks)
      .orderBy(agentSubTasks.createdAt)
      .limit(20);

    console.log('[Debug] 找到', allAgentSubTasks.length, '个 agent_sub_tasks');

    // 4. 查询所有 daily_task
    const allDailyTasks = await db
      .select()
      .from(dailyTask)
      .orderBy(dailyTask.createdAt)
      .limit(20);

    console.log('[Debug] 找到', allDailyTasks.length, '个 daily_task');

    // 5. 格式化输出
    const formattedAgentTasks = latestAgentTasks.map(task => ({
      id: task.id,
      taskId: task.taskId,
      taskName: task.taskName,
      splitStatus: task.splitStatus,
      taskStatus: task.taskStatus,
      coreCommand: task.coreCommand.substring(0, 100) + (task.coreCommand.length > 100 ? '...' : ''),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    }));

    const formattedAgentSubTasks = allAgentSubTasks.map(task => ({
      id: task.id,
      commandResultId: task.commandResultId,
      taskId: task.taskId,
      status: task.status,
      orderIndex: task.orderIndex,
      executionDate: task.executionDate,
      fromParentsExecutor: task.fromParentsExecutor,
      startedAt: task.startedAt ? task.startedAt.toISOString() : null,
      taskTitle: task.taskTitle,
      createdAt: task.createdAt.toISOString(),
    }));

    const formattedDailyTasks = allDailyTasks.map(task => ({
      id: task.id,
      commandId: task.commandId,
      relatedTaskId: task.relatedTaskId,
      taskTitle: task.taskTitle,
      executor: task.executor,
      executionDate: task.executionDate,
      executionStatus: task.executionStatus,
      createdAt: task.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      debugInfo: {
        currentBeijingTime: now.toISOString(),
        todayString: today,
      },
      agentTasks: formattedAgentTasks,
      agentSubTasks: formattedAgentSubTasks,
      dailyTask: formattedDailyTasks,
    });
  } catch (error) {
    console.error('[Debug] 检查失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '检查失败' },
      { status: 500 }
    );
  }
}

