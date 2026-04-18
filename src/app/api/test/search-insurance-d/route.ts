import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentTasks, dailyTask } from '@/lib/db/schema';
import { desc, or, like } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // 查询 agent_tasks 表中 insurance-d 的最新任务（最近 10 条）
    const recentTasks = await db
      .select()
      .from(agentTasks)
      .where(
        or(
          like(agentTasks.executor, '%insurance-d%'),
          like(agentTasks.coreCommand, '%保险科普%')
        )
      )
      .orderBy(desc(agentTasks.createdAt))
      .limit(10);

    // 查询 command_results 表中的所有 insurance-d 记录（最近 10 条）
    const recentCommands = await db
      .select()
      .from(dailyTask)
      .where(
        or(
          like(dailyTask.executor, '%insurance-d%'),
          like(dailyTask.commandContent, '%保险科普%')
        )
      )
      .orderBy(desc(dailyTask.createdAt))
      .limit(10);

    // 检查最近 5 分钟内的记录
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const recentTasks5min = recentTasks.filter(t => new Date(t.createdAt) >= fiveMinutesAgo);
    const recentCommands5min = recentCommands.filter(c => new Date(c.createdAt) >= fiveMinutesAgo);

    return NextResponse.json({
      success: true,
      message: 'agent_tasks 和 command_results 查询结果',
      agentTasks: {
        total: recentTasks.length,
        recent5min: recentTasks5min.length,
        latest: recentTasks.map(t => ({
          taskId: t.taskId,
          taskName: t.taskName,
          executor: t.executor,
          status: t.taskStatus,
          commandPreview: t.coreCommand.substring(0, 80),
          createdAt: t.createdAt,
        })),
      },
      dailyTask: {
        total: recentCommands.length,
        recent5min: recentCommands5min.length,
        latest: recentCommands.map(c => ({
          commandId: c.commandId,
          executor: c.executor,
          status: c.executionStatus,
          commandPreview: c.commandContent.substring(0, 80),
          createdAt: c.createdAt,
        })),
      },
      summary: {
        hasRecentTask: recentTasks5min.length > 0,
        hasRecentCommand: recentCommands5min.length > 0,
        message: recentTasks5min.length > 0 || recentCommands5min.length > 0
          ? `✅ 找到最近 5 分钟内的记录`
          : `❌ 未找到最近 5 分钟内的新记录`,
      },
    });
  } catch (error) {
    console.error('查询失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
