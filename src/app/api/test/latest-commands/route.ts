import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask, agentSubTasks } from '@/lib/db/schema';
import { desc, eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // 查询 command_results 表最新的 10 条记录
    const latestCommands = await db
      .select()
      .from(dailyTask)
      .orderBy(desc(dailyTask.createdAt))
      .limit(10);

    // 查询关联的子任务信息
    const results = await Promise.all(
      latestCommands.map(async (cmd) => {
        const subTasks = await db
          .select()
          .from(agentSubTasks)
          .where(eq(agentSubTasks.commandResultId, cmd.id));

        return {
          commandId: cmd.id,
          commandContent: cmd.commandContent,
          executor: cmd.executor,
          executionStatus: cmd.executionStatus,
          completedAt: cmd.completedAt,
          createdAt: cmd.createdAt,
          subTaskCount: subTasks.length,
          subTasks: subTasks.map(st => ({
            id: st.id,
            agentId: st.agentId,
            taskTitle: st.taskTitle,
            status: st.status,
            startedAt: st.startedAt,
            completedAt: st.completedAt,
            hasExecutionResult: !!st.executionResult,
          })),
        };
      })
    );

    return NextResponse.json({
      success: true,
      message: 'command_results 最新数据',
      count: results.length,
      data: results,
    });
  } catch (error) {
    console.error('查询 command_results 失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
