import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const orderIndex = searchParams.get('orderIndex');

    let task;

    if (taskId) {
      const tasks = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.id, taskId));
      
      if (tasks.length > 0) {
        task = tasks[0];
      }
    } else if (orderIndex) {
      const tasks = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.orderIndex, parseInt(orderIndex)))
        .limit(1);
      
      if (tasks.length > 0) {
        task = tasks[0];
      }
    }

    if (task) {
      return NextResponse.json({
        success: true,
        task
      });
    } else {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

  } catch (error) {
    console.error('[GetTaskDetail] 错误:', error);
    return NextResponse.json(
      { error: '查询失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
