import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentTasks } from '@/lib/db/schema';
import { eq, or, and } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/context';

/**
 * GET /api/agents/pending-commands - 查询待处理指令
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { workspaceId } = authResult;

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    console.log(`📥 查询待处理指令: agentId=${agentId || 'all'}`);

    // 查询条件：workspace 隔离 + 状态为待处理或执行中的任务
    const baseConditions = [eq(agentTasks.workspaceId, workspaceId)];
    const statusCondition = or(
      eq(agentTasks.taskStatus, 'pending'),
      eq(agentTasks.taskStatus, 'in_progress'),
      eq(agentTasks.taskStatus, 'splitting')
    );

    // 如果指定了 agentId，则查询该 Agent 发出的任务
    const agentCondition = agentId
      ? eq(agentTasks.fromAgentId, agentId)
      : undefined;

    const whereCondition = agentCondition
      ? and(statusCondition, agentCondition, ...baseConditions)
      : and(statusCondition, ...baseConditions);

    // 查询待处理指令
    const pendingCommands = await db
      .select({
        taskId: agentTasks.taskId,
        taskName: agentTasks.taskName,
        executor: agentTasks.executor,
        fromAgentId: agentTasks.fromAgentId,
        coreCommand: agentTasks.coreCommand,
        taskStatus: agentTasks.taskStatus,
        taskPriority: agentTasks.taskPriority,
        createdAt: agentTasks.createdAt,
        taskDurationStart: agentTasks.taskDurationStart,
      })
      .from(agentTasks)
      .where(whereCondition)
      .orderBy(agentTasks.createdAt);

    console.log(`✅ 查询到 ${pendingCommands.length} 条待处理指令`);

    return NextResponse.json({
      success: true,
      data: {
        pendingCommands,
      },
    });
  } catch (error) {
    console.error('❌ 查询待处理指令时出错:', error);
    return NextResponse.json(
      {
        success: false,
        error: '查询失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
