/**
 * 测试 API - 查询任务相关数据
 * GET /api/test/task-data?taskId=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory, agentSubTasksMcpExecutions } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: '请提供 taskId 参数' },
        { status: 400 }
      );
    }

    console.log(`🧪 测试 API - 查询任务数据，taskId: ${taskId}`);

    // 1. 查询子任务
    const subTask = await db.query.agentSubTasks.findFirst({
      where: eq(agentSubTasks.id, taskId),
    });

    if (!subTask) {
      return NextResponse.json(
        { success: false, error: '未找到任务' },
        { status: 404 }
      );
    }

    console.log(`✅ 找到子任务:`, {
      id: subTask.id,
      commandResultId: subTask.commandResultId,
      orderIndex: subTask.orderIndex,
      status: subTask.status,
    });

    // 2. 查询交互历史
    const stepHistory = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, subTask.commandResultId),
          eq(agentSubTasksStepHistory.stepNo, subTask.orderIndex)
        )
      )
      .orderBy(agentSubTasksStepHistory.interactTime);

    console.log(`📜 交互历史记录数: ${stepHistory.length}`);
    if (stepHistory.length > 0) {
      console.log(`   第一条记录:`, stepHistory[0]);
    }

    // 3. 查询 MCP 执行记录
    const mcpExecutions = await db
      .select()
      .from(agentSubTasksMcpExecutions)
      .where(
        and(
          eq(agentSubTasksMcpExecutions.commandResultId, subTask.commandResultId),
          eq(agentSubTasksMcpExecutions.orderIndex, subTask.orderIndex)
        )
      )
      .orderBy(desc(agentSubTasksMcpExecutions.attemptTimestamp));

    console.log(`🔧 MCP 执行记录数: ${mcpExecutions.length}`);
    if (mcpExecutions.length > 0) {
      console.log(`   第一条记录:`, mcpExecutions[0]);
    }

    return NextResponse.json({
      success: true,
      data: {
        subTask,
        stepHistoryCount: stepHistory.length,
        stepHistory,
        mcpExecutionsCount: mcpExecutions.length,
        mcpExecutions,
      },
    });
  } catch (error) {
    console.error('❌ 测试 API 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '查询失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
