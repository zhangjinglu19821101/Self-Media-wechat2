/**
 * 手动触发 Agent B 评审 order_index=4 任务
 * GET /api/test/trigger-order4-agent-b-review
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { SubtaskExecutionEngine } from '@/lib/services/subtask-execution-engine';

export async function GET(request: NextRequest) {
  try {
    console.log('[TriggerOrder4Review] 开始手动触发 Agent B 评审...');

    // 1. 查找 order_index=4 的任务
    const tasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.orderIndex, 4));

    if (tasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: '找不到 order_index=4 的任务'
      }, { status: 404 });
    }

    const task = tasks[0];
    console.log('[TriggerOrder4Review] 找到任务:', {
      id: task.id,
      taskTitle: task.taskTitle,
      status: task.status,
      fromParentsExecutor: task.fromParentsExecutor
    });

    // 2. 将状态改回 pre_completed
    await db
      .update(agentSubTasks)
      .set({ status: 'pre_completed' })
      .where(eq(agentSubTasks.id, task.id));

    console.log('[TriggerOrder4Review] 已将任务状态改为 pre_completed');

    // 3. 调用 Agent B 评审
    const engine = new SubtaskExecutionEngine();
    console.log('[TriggerOrder4Review] 开始调用 Agent B 评审...');
    
    const result = await engine.executeAgentBReviewWorkflow(task);

    console.log('[TriggerOrder4Review] Agent B 评审完成, result:', JSON.stringify(result, null, 2));

    // 4. 查询更新后的任务状态
    const updatedTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, task.id));
    
    const updatedTask = updatedTasks[0];

    return NextResponse.json({
      success: true,
      message: 'Agent B 评审完成',
      data: {
        taskId: updatedTask.id,
        taskTitle: updatedTask.taskTitle,
        previousStatus: task.status,
        currentStatus: updatedTask.status,
        fromParentsExecutor: updatedTask.fromParentsExecutor,
        agentBResult: result
      }
    });

  } catch (error) {
    console.error('[TriggerOrder4Review] 失败:', error);

    return NextResponse.json({
      success: false,
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
