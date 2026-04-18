/**
 * GET /api/query/agent-sub-tasks
 * 查询 agent_sub_tasks 表数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq, and, gte, lte, desc, like } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get('taskId');
    const agentId = searchParams.get('agentId');
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const limit = parseInt(searchParams.get('limit') || '50');

    console.log(`📋 查询 agent_sub_tasks 表: taskId=${taskId}, agentId=${agentId}, startTime=${startTime}, endTime=${endTime}, limit=${limit}`);

    // 构建查询条件
    const conditions = [];

    if (taskId) {
      // 可以模糊匹配 taskId 或 relatedTaskId
      conditions.push(
        like(agentSubTasks.commandResultId, `%${taskId}%`)
      );
    }

    if (agentId) {
      conditions.push(eq(agentSubTasks.fromParentsExecutor, agentId));
    }

    if (startTime) {
      conditions.push(gte(agentSubTasks.createdAt, new Date(startTime)));
    }

    if (endTime) {
      conditions.push(lte(agentSubTasks.createdAt, new Date(endTime)));
    }

    // 执行查询
    const tasks = await db
      .select({
        id: agentSubTasks.id,
        commandResultId: agentSubTasks.commandResultId,
        fromParentsExecutor: agentSubTasks.fromParentsExecutor,
        taskTitle: agentSubTasks.taskTitle,
        taskDescription: agentSubTasks.taskDescription,
        status: agentSubTasks.status,
        orderIndex: agentSubTasks.orderIndex,
        createdAt: agentSubTasks.createdAt,
        updatedAt: agentSubTasks.updatedAt,
      })
      .from(agentSubTasks)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(agentSubTasks.createdAt))
      .limit(limit);

    console.log(`✅ 查询成功: 找到 ${tasks.length} 条记录`);

    return NextResponse.json({
      success: true,
      data: {
        tasks,
        count: tasks.length,
      },
    });
  } catch (error) {
    console.error('❌ 查询 agent_sub_tasks 表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
