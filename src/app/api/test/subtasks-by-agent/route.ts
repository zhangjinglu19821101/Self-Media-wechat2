import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId');

    if (!agentId) {
      return NextResponse.json({
        success: false,
        error: 'Missing agentId parameter',
      }, { status: 400 });
    }

    const tasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.agentId, agentId))
      .orderBy(agentSubTasks.createdAt);

    return NextResponse.json({
      success: true,
      agentId,
      tasks: tasks.map(task => ({
        id: task.id,
        taskTitle: task.taskTitle,
        status: task.status,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        executionResultLength: task.executionResult ? task.executionResult.length : 0,
      })),
    });
  } catch (error) {
    console.error('获取子任务列表失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
