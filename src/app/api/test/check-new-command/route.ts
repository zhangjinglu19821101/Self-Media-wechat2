import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask, agentSubTasks } from '@/lib/db/schema';
import { desc, eq, or, and, like } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // 查询最新的 command_results 记录（最近 10 条）
    const latestCommands = await db
      .select()
      .from(dailyTask)
      .orderBy(desc(dailyTask.createdAt))
      .limit(10);

    // 查询每个命令的子任务
    const results = await Promise.all(
      latestCommands.map(async (cmd) => {
        const subTasks = await db
          .select()
          .from(agentSubTasks)
          .where(eq(agentSubTasks.commandResultId, cmd.id));

        return {
          commandId: cmd.id,
          commandContent: cmd.commandContent?.substring(0, 100),
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
        };
      })
    );

    // 检查是否有符合用户描述的新指令
    const insuranceDCommands = results.filter(r =>
      r.executor === 'insurance-d' &&
      r.createdAt >= new Date(Date.now() - 10 * 60 * 1000) // 最近 10 分钟内的
    );

    return NextResponse.json({
      success: true,
      message: 'command_results 最新记录',
      count: results.length,
      recentInsuranceDCount: insuranceDCommands.length,
      latestCommands: results,
      insuranceDRecent: insuranceDCommands,
      checkResult: insuranceDCommands.length > 0
        ? `✅ 找到 ${insuranceDCommands.length} 条最近 10 分钟内的 insurance-d 指令`
        : `❌ 未找到最近 10 分钟内的新指令`,
    });
  } catch (error) {
    console.error('查询 command_results 失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
