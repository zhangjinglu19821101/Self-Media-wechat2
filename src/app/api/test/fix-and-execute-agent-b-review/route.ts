import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { subtaskEngine } from '@/lib/services/subtask-execution-engine';

export async function POST(request: NextRequest) {
  try {
    const { taskId } = await request.json();

    if (!taskId) {
      return NextResponse.json({ error: '缺少 taskId 参数' }, { status: 400 });
    }

    console.log('[FixAndExecuteAgentBReview] 开始处理', { taskId });

    // Step 1: 查询任务
    const tasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, taskId));

    if (tasks.length === 0) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    const task = tasks[0];
    console.log('[FixAndExecuteAgentBReview] 找到任务', {
      taskId: task.id,
      orderIndex: task.orderIndex,
      status: task.status,
      executor: task.executor
    });

    // Step 2: 如果状态是 waiting_user，先更新为 pre_need_support
    let taskToProcess = task;
    if (task.status === 'waiting_user') {
      console.log('[FixAndExecuteAgentBReview] 状态是 waiting_user，先更新为 pre_need_support');
      
      await db
        .update(agentSubTasks)
        .set({
          status: 'pre_need_support',
          updatedAt: new Date()
        })
        .where(eq(agentSubTasks.id, taskId));

      // 重新查询任务
      const updatedTasks = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.id, taskId));

      if (updatedTasks.length === 0) {
        return NextResponse.json({ error: '更新后任务不存在' }, { status: 404 });
      }

      taskToProcess = updatedTasks[0];
      console.log('[FixAndExecuteAgentBReview] 状态已更新', { newStatus: taskToProcess.status });
    }

    // Step 3: 执行 Agent B 评审
    console.log('[FixAndExecuteAgentBReview] 开始执行 Agent B 评审');
    
    // 使用类型断言调用私有方法
    await (subtaskEngine as any).executeAgentBReviewWorkflow(taskToProcess);

    // Step 4: 查询最终状态
    const finalTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, taskId));

    console.log('[FixAndExecuteAgentBReview] 处理完成', {
      taskId: finalTasks[0].id,
      finalStatus: finalTasks[0].status
    });

    return NextResponse.json({
      success: true,
      task: finalTasks[0]
    });

  } catch (error) {
    console.error('[FixAndExecuteAgentBReview] 错误:', error);
    return NextResponse.json(
      { error: '处理失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
