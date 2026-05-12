import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { subtaskEngine } from '@/lib/services/subtask-execution-engine';

export async function GET(request: NextRequest) {
  try {
    console.log('[DEBUG] 开始调试执行 order_index=2 的任务');

    // 1. 查询 order_index=2 的任务
    const tasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.orderIndex, 2))
      .limit(1);

    if (tasks.length === 0) {
      return NextResponse.json({ error: '未找到 order_index=2 的任务' }, { status: 404 });
    }

    const task = tasks[0];
    console.log('[DEBUG] 找到任务:', {
      id: task.id,
      commandResultId: task.commandResultId,
      status: task.status,
      taskTitle: task.taskTitle
    });

    // 2. 重置任务状态为 pending，以便重新执行
    await db
      .update(agentSubTasks)
      .set({
        status: 'pending',
        resultData: null,
        updatedAt: new Date()
      })
      .where(eq(agentSubTasks.id, task.id));

    console.log('[DEBUG] 任务状态已重置为 pending');

    // 3. 使用执行引擎单例
    const engine = subtaskEngine;

    // 4. 手动调用 Agent T 执行（使用类型断言访问私有方法）
    console.log('[DEBUG] 开始调用 Agent T 执行...');
    
    // @ts-ignore - 访问私有方法
    await engine.executeAgentTExecutorWorkflow(task);

    console.log('[DEBUG] Agent T 执行完成');

    // 5. 查询更新后的任务状态
    const updatedTask = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, task.id))
      .limit(1)
      .then(res => res[0]);

    return NextResponse.json({
      success: true,
      message: '调试执行完成',
      task: {
        id: updatedTask?.id,
        status: updatedTask?.status,
        resultData: updatedTask?.resultData
      }
    });

  } catch (error) {
    console.error('[DEBUG] 调试执行失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
