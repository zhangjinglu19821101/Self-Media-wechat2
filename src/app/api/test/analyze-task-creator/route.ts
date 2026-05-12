import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentTasks } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // 查询最新的 insurance-d 相关任务
    const [latestTask] = await db
      .select()
      .from(agentTasks)
      .where(eq(agentTasks.executor, 'B'))
      .orderBy(desc(agentTasks.createdAt))
      .limit(1);

    if (!latestTask) {
      return NextResponse.json({
        success: false,
        message: '未找到任务',
      });
    }

    // 提取指令中的执行主体（改进版）
    const coreCommand = latestTask.coreCommand || '';
    const executorMatch = coreCommand.match(/\*\*执行主体[：:]\s*「([^\"]+)」/);
    const actualExecutor = executorMatch ? executorMatch[1] : '未找到';

    return NextResponse.json({
      success: true,
      analysis: {
        taskId: latestTask.taskId,
        databaseExecutor: latestTask.executor,  // 数据库中的 executor 字段 = 'B'
        toAgentId: latestTask.toAgentId,         // 接收方 = 'agent B'
        actualExecutorFromCommand: actualExecutor, // 指令中的执行主体 = 'insurance-d'
        problem: actualExecutor === 'insurance-d'
          ? '❌ 问题：指令给 insurance-d，但任务创建时 toAgentId=agent B，executor=B'
          : '✅ 任务正确',
        correctLogic: `属于 ${actualExecutor} 的任务 → 应该由 ${actualExecutor} 拆解`,
        whatActuallyHappened: `由于 executor=B，所以由 Agent B 进行了拆解`,
      },
      whatIDidToday: `
今天发生的事情：
1. Agent A 创建任务，设置 toAgentId='agent B'，所以 executor='B'
2. 指令内容明确写着：执行主体：「insurance-d」
3. 任务入库后，splitStatus='pending_split'
4. 没有定时任务自动触发拆解
5. 我手动触发了拆解接口：POST /api/agents/tasks/[taskId]/split
6. 由于 executor='B'，所以调用了 Agent B 的拆解逻辑
7. Agent B 生成了 3 个子任务

问题：应该由 insurance-d 拆解，但实际由 Agent B 拆解了
      `.trim(),
    });
  } catch (error) {
    console.error('查询失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
