import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const { orderIndex, commandResultId, force } = await request.json();
    
    console.log('[API] 强力重置任务状态:', { orderIndex, commandResultId, force });
    
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
    console.log('[API] 当前任务状态:', {
      id: task.id,
      status: task.status,
      startedAt: task.startedAt,
      metadata: task.metadata
    });
    
    // 强力重置：清除可能导致问题的字段
    const updateData: any = {
      status: 'pending',
      startedAt: null,
    };
    
    if (force) {
      // 强力模式：清除更多字段
      updateData.metadata = {
        ...(task.metadata as any || {}),
        lastAgentBDecision: null,
        reexecuteHistory: [],
        userForcedExecutor: null,
        userForcedExecutorAt: null,
        userForcedExecutorReason: null,
        lastReexecuteTimestamp: null,
      };
    }
    
    // 更新状态
    await db
      .update(agentSubTasks)
      .set(updateData)
      .where(eq(agentSubTasks.id, task.id));
    
    // 重新查询确认
    const updatedTask = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, task.id));
    
    return NextResponse.json({
      success: true,
      message: '任务状态已强力重置',
      task: {
        id: updatedTask[0].id,
        oldStatus: task.status,
        newStatus: updatedTask[0].status,
        startedAt: updatedTask[0].startedAt
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