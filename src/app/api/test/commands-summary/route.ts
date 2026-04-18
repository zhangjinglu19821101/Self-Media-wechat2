import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask, agentSubTasks } from '@/lib/db/schema';
import { desc, eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // 查询 command_results 表最新的记录及其子任务详情
    const latestCommands = await db
      .select()
      .from(dailyTask)
      .orderBy(desc(dailyTask.createdAt))
      .limit(10);

    const results = await Promise.all(
      latestCommands.map(async (cmd) => {
        const subTasks = await db
          .select()
          .from(agentSubTasks)
          .where(eq(agentSubTasks.commandResultId, cmd.id));

        return {
          commandId: cmd.id,
          commandContent: cmd.commandContent?.substring(0, 50) + '...',
          executor: cmd.executor,
          executionStatus: cmd.executionStatus,
          createdAt: cmd.createdAt,
          completedAt: cmd.completedAt,
          subTaskCount: subTasks.length,
          subTasksSummary: {
            total: subTasks.length,
            completed: subTasks.filter(st => st.status === 'completed').length,
            in_progress: subTasks.filter(st => st.status === 'in_progress').length,
            failed: subTasks.filter(st => st.status === 'failed').length,
            pending: subTasks.filter(st => st.status === 'pending').length,
          },
          subTasks: subTasks.map(st => ({
            id: st.id,
            agentId: st.agentId,
            taskTitle: st.taskTitle,
            status: st.status,
            startedAt: st.startedAt,
            completedAt: st.completedAt,
            executionResultLength: st.executionResult ? st.executionResult.length : 0,
          })),
        };
      })
    );

    return NextResponse.json({
      success: true,
      message: 'command_results 最新执行状态',
      count: results.length,
      data: results,
      summary: {
        totalCommands: results.length,
        completedCommands: results.filter(r => r.executionStatus === 'completed').length,
        inProgressCommands: results.filter(r => r.executionStatus === 'in_progress').length,
        totalSubTasks: results.reduce((sum, r) => sum + r.subTaskCount, 0),
        completedSubTasks: results.reduce((sum, r) => sum + r.subTasksSummary.completed, 0),
        failedSubTasks: results.reduce((sum, r) => sum + r.subTasksSummary.failed, 0),
      },
    });
  } catch (error) {
    console.error('查询 command_results 失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
