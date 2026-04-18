/**
 * 检查 daily_task 表数据
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET() {
  const taskId = '58ea520c-e7f1-4c27-bd24-2b3aab034066';
  
  try {
    // 先查询所有 daily_task
    const allTasks = await db
      .select()
      .from(dailyTask)
      .orderBy(desc(dailyTask.createdAt))
      .limit(10);
    
    // 再查询指定的 task
    const specificTask = await db
      .select()
      .from(dailyTask)
      .where(eq(dailyTask.id, taskId))
      .limit(1);
    
    return NextResponse.json({
      success: true,
      allTasksCount: allTasks.length,
      allTasks: allTasks.map(t => ({
        id: t.id,
        taskTitle: t.taskTitle,
        status: t.status,
      })),
      specificTaskFound: specificTask.length > 0,
      specificTask: specificTask.length > 0 ? specificTask[0] : null,
    });
    
  } catch (error) {
    console.error('❌ 查询失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
