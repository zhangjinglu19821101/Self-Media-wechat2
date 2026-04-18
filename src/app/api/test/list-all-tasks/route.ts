import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';

export async function GET(request: NextRequest) {
  try {
    const tasks = await db
      .select()
      .from(agentSubTasks)
      .orderBy(agentSubTasks.orderIndex);

    return NextResponse.json({
      success: true,
      tasks: tasks.map(task => ({
        id: task.id,
        orderIndex: task.orderIndex,
        status: task.status,
        executor: task.executor
      }))
    });

  } catch (error) {
    console.error('[ListAllTasks] 错误:', error);
    return NextResponse.json(
      { error: '查询失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
