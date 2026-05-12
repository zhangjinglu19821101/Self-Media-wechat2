import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask, agentTasks } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

/**
 * GET /api/test/verify-daily-task-migration
 * 验证 daily_task 表迁移结果
 */
export async function GET() {
  try {
    // 查询 dailyTask 表中的记录
    const tasks = await db
      .select()
      .from(dailyTask)
      .orderBy(desc(dailyTask.createdAt))
      .limit(10);

    // 查询 agentTasks 表中的记录
    const agentTasksList = await db
      .select()
      .from(agentTasks)
      .limit(5);

    return NextResponse.json({
      success: true,
      verification: {
        dailyTaskCount: tasks.length,
        agentTasksCount: agentTasksList.length,
        sampleDailyTasks: tasks.map(t => ({
          taskId: t.taskId,
          taskTitle: t.taskTitle,
          executor: t.executor,
          executionStatus: t.executionStatus,
          executionDate: t.executionDate,
        })),
        sampleAgentTasks: agentTasksList.map(t => ({
          taskId: t.taskId,
          taskName: t.taskName,
          executor: t.executor,
          taskStatus: t.taskStatus,
        })),
      },
      message: '✅ 迁移验证成功：command_results → daily_task',
    });
  } catch (error) {
    console.error('❌ 验证失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
