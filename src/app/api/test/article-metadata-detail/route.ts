import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    
    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    console.log('[ArticleMetadataDetail] 查询任务的 article_metadata, taskId:', taskId);

    // 查询任务
    const tasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, taskId));

    if (tasks.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const task = tasks[0];

    return NextResponse.json({
      success: true,
      task: {
        id: task.id,
        title: task.taskTitle,
        orderIndex: task.orderIndex,
        status: task.status,
        fromParentsExecutor: task.fromParentsExecutor,
      },
      hasArticleMetadata: !!task.articleMetadata,
      articleMetadata: task.articleMetadata,
    });

  } catch (error) {
    console.error('[ArticleMetadataDetail] 查询失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
