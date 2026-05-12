import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { desc, limit } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const count = parseInt(searchParams.get('count') || '20');
    
    console.log('[ListTasks] 查询最近的任务, count:', count);

    const tasks = await db
      .select()
      .from(agentSubTasks)
      .orderBy(desc(agentSubTasks.createdAt))
      .limit(count);

    console.log('[ListTasks] 找到任务数量:', tasks.length);

    const simplifiedTasks = tasks.map(task => ({
      id: task.id,
      title: task.taskTitle,
      orderIndex: task.orderIndex,
      status: task.status,
      fromParentsExecutor: task.fromParentsExecutor,
      createdAt: task.createdAt,
      hasArticleMetadata: !!task.articleMetadata,
      articleMetadataStepStatus: task.articleMetadata?.current_step?.step_status,
    }));

    return NextResponse.json({
      success: true,
      count: tasks.length,
      tasks: simplifiedTasks,
    });

  } catch (error) {
    console.error('[ListTasks] 查询失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
