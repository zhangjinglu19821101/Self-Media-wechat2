import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { SubtaskExecutionEngine } from '@/lib/services/subtask-execution-engine';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

export async function POST(request: NextRequest) {
  try {
    const { taskId } = await request.json();

    if (!taskId) {
      return NextResponse.json({ error: '缺少 taskId 参数' }, { status: 400 });
    }

    console.log('[TestRealAgentB] 开始处理', { taskId });

    // Step 1: 查询任务
    const tasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, taskId));

    if (tasks.length === 0) {
      return NextResponse.json({ error: '任务不存在' }, { status: 404 });
    }

    const task = tasks[0];
    console.log('[TestRealAgentB] 找到任务', {
      taskId: task.id,
      orderIndex: task.orderIndex,
      status: task.status,
      executor: task.fromParentsExecutor
    });

    // Step 2: 修改任务状态为 pre_completed
    console.log('[TestRealAgentB] 修改任务状态为 pre_completed');
    await db.update(agentSubTasks).set({
      status: 'pre_completed',
      updatedAt: getCurrentBeijingTime()
    }).where(eq(agentSubTasks.id, taskId));

    // Step 3: 重新查询任务
    const updatedTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, taskId));
    const updatedTask = updatedTasks[0];

    // Step 4: 执行 Agent B 评审
    console.log('[TestRealAgentB] 开始执行 Agent B 评审');
    const engine = new SubtaskExecutionEngine();
    await (engine as any).executeAgentBReviewWorkflow(updatedTask);

    // Step 5: 查询最终状态
    const finalTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, taskId));

    console.log('[TestRealAgentB] 处理完成', {
      taskId: finalTasks[0].id,
      finalStatus: finalTasks[0].status
    });

    return NextResponse.json({
      success: true,
      task: finalTasks[0]
    });

  } catch (error) {
    console.error('[TestRealAgentB] 错误:', error);
    return NextResponse.json(
      { error: '处理失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}