import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const { orderIndex, commandResultId } = await request.json();
    
    console.log('[API] 重置任务状态:', { orderIndex, commandResultId });
    
    // 查找任务
    const tasks = await db
      .select()
      .from(agentSubTasks)
      .where(
        and(
          eq(agentSubTasks.orderIndex, orderIndex),
          eq(agentSubTasks.commandResultId, commandResultId)
        )
      );
    
    if (tasks.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: '未找到任务' 
      }, { status: 404 });
    }
    
    const task = tasks[0];
    console.log('[API] 当前任务状态:', task.status);
    
    // 更新状态
    await db
      .update(agentSubTasks)
      .set({
        status: 'pending',
        startedAt: null,
      })
      .where(eq(agentSubTasks.id, task.id));
    
    return NextResponse.json({
      success: true,
      message: '任务状态已更新为 pending',
      task: {
        id: task.id,
        oldStatus: task.status,
        newStatus: 'pending'
      }
    });
    
  } catch (error) {
    console.error('[API] 错误:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '未知错误' 
    }, { status: 500 });
  }
}