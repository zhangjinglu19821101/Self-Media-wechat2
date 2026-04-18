import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderIndex = searchParams.get('orderIndex');

    if (!orderIndex) {
      return NextResponse.json({ error: '缺少 orderIndex 参数' }, { status: 400 });
    }

    const tasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.orderIndex, parseInt(orderIndex)))
      .limit(1);

    if (tasks.length === 0) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      task: tasks[0]
    });

  } catch (error) {
    console.error('[GetTaskByOrderIndex] 错误:', error);
    return NextResponse.json(
      { error: '查询失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
