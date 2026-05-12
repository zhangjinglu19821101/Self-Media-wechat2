/**
 * 列出所有子任务
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const subTasks = await db
      .select()
      .from(agentSubTasks)
      .orderBy(desc(agentSubTasks.createdAt))
      .limit(20);
    
    return NextResponse.json({
      success: true,
      count: subTasks.length,
      subTasks: subTasks.map(st => ({
        id: st.id,
        taskTitle: st.taskTitle,
        orderIndex: st.orderIndex,
        fromParentsExecutor: st.fromParentsExecutor,
        commandResultId: st.commandResultId,
        status: st.status,
      })),
    });
    
  } catch (error) {
    console.error('❌ 查询失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
