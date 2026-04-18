/**
 * 查询 agent_sub_tasks 表中的数据（用于测试）
 * GET /api/test/query-subtasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [test-query-subtasks] 查询 agent_sub_tasks 数据');

    // 查询最近的 10 条子任务
    const tasks = await db
      .select()
      .from(agentSubTasks)
      .orderBy(desc(agentSubTasks.createdAt))
      .limit(10);

    console.log(`✅ [test-query-subtasks] 找到 ${tasks.length} 条子任务`);

    // 格式化返回数据（只返回关键字段）
    const formattedTasks = tasks.map(task => ({
      id: task.id,
      commandResultId: task.commandResultId,
      orderIndex: task.orderIndex,
      fromParentsExecutor: task.fromParentsExecutor,
      status: task.status,
      taskTitle: task.taskTitle?.substring(0, 100),
      hasResultData: !!task.resultData,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    }));

    return NextResponse.json({
      success: true,
      data: {
        count: tasks.length,
        tasks: formattedTasks
      },
    });
  } catch (error) {
    console.error('❌ [test-query-subtasks] 查询失败:', error);
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
