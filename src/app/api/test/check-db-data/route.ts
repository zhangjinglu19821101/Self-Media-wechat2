import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('[检查数据库] 开始查询...');

    // 1. 查询最新的子任务
    const latestSubTasks = await db
      .select()
      .from(agentSubTasks)
      .orderBy(desc(agentSubTasks.createdAt))
      .limit(5);

    const result = {
      latestSubTasks: latestSubTasks.map(t => ({
        id: t.id,
        commandResultId: t.commandResultId,
        orderIndex: t.orderIndex,
        status: t.status,
        taskTitle: t.taskTitle,
        resultData: t.resultData,
        createdAt: t.createdAt
      }))
    };

    console.log('[检查数据库] 查询完成:', {
      subTasksCount: latestSubTasks.length
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[检查数据库] 错误:', error);
    return NextResponse.json(
      { 
        error: '查询失败', 
        message: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}
