import { NextRequest, NextResponse } from 'next/server';
import { subtaskEngine } from '@/lib/services/subtask-execution-engine';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { agentSubTasks } from '@/lib/db/schema';

// 直接执行 order_index=2 任务的 API 接口
export async function POST(request: NextRequest) {
  try {
    // 从请求中获取 commandResultId（可选，默认为最新的）
    let { commandResultId } = await request.json().catch(() => ({}));

    // 如果没有提供，从 agent_sub_tasks 表中查询最新的 commandResultId
    if (!commandResultId) {
      const latestTasks = await db
        .select({ commandResultId: agentSubTasks.commandResultId })
        .from(agentSubTasks)
        .orderBy(agentSubTasks.createdAt)
        .limit(1);

      if (latestTasks.length > 0) {
        commandResultId = latestTasks[0].commandResultId;
      }
    }

    console.log('[ExecuteOrder2Task] 使用 commandResultId:', commandResultId);

    // 1. 获取 order_index=2 的任务
    const allTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.commandResultId, commandResultId));

    const task = allTasks.find(t => t.orderIndex === 2);

    if (!task) {
      return NextResponse.json({ error: '未找到 order_index=2 的任务' }, { status: 404 });
    }

    console.log('[ExecuteOrder2Task] 找到任务:', {
      taskId: task.id,
      orderIndex: task.orderIndex,
      status: task.status,
      taskTitle: task.taskTitle
    });

    // 2. 直接调用私有方法 executeAgentTExecutorWorkflow
    console.log('[ExecuteOrder2Task] 调用 executeAgentTExecutorWorkflow...');
    
    // 使用类型断言访问私有方法
    const engine = subtaskEngine as any;
    await engine.executeAgentTExecutorWorkflow(task);

    console.log('[ExecuteOrder2Task] ========== 任务执行完成 ==========');

    // 3. 查询最新状态
    const updatedTask = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, task.id))
      .then(res => res[0]);

    return NextResponse.json({
      success: true,
      message: 'order_index=2 任务执行完成',
      task: updatedTask
    });

  } catch (error) {
    console.error('[ExecuteOrder2Task] 执行失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '执行失败' },
      { status: 500 }
    );
  }
}
