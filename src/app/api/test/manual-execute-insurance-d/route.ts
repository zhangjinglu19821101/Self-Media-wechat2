/**
 * 手动执行 insurance-d 的测试接口
 * 专门执行 insurance-d（执行 Agent），不包括 Agent B 评审
 */
import { NextRequest, NextResponse } from 'next/server';
import { subtaskEngine } from '@/lib/services/subtask-execution-engine';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { agentSubTasks } from '@/lib/db/schema';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

// 手动执行 insurance-d 的 API 接口
export async function POST(request: NextRequest) {
  try {
    // 从请求中获取参数
    let { commandResultId, orderIndex, resetStatus } = await request.json().catch(() => ({}));

    if (!commandResultId) {
      return NextResponse.json({ error: '缺少 commandResultId 参数' }, { status: 400 });
    }

    console.log('[ManualExecuteInsuranceD] 开始执行 insurance-d', { commandResultId, orderIndex, resetStatus });

    // 1. 获取任务
    let query = db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.commandResultId, commandResultId));
    
    if (orderIndex !== undefined) {
      query = query.where(eq(agentSubTasks.orderIndex, orderIndex));
    }
    
    const tasks = await query.orderBy(agentSubTasks.orderIndex);

    if (tasks.length === 0) {
      return NextResponse.json({ error: '未找到指定的任务' }, { status: 404 });
    }

    const task = tasks[0];
    console.log('[ManualExecuteInsuranceD] 找到任务:', {
      taskId: task.id,
      orderIndex: task.orderIndex,
      status: task.status,
      executor: task.fromParentsExecutor,
      taskTitle: task.taskTitle
    });

    // 2. 如果需要重置状态，先重置为 pending
    if (resetStatus !== false) {
      console.log('[ManualExecuteInsuranceD] 重置任务状态为 pending...');
      await db
        .update(agentSubTasks)
        .set({
          status: 'pending',
          updatedAt: getCurrentBeijingTime()
        })
        .where(eq(agentSubTasks.id, task.id));
      console.log('[ManualExecuteInsuranceD] 状态已重置');
    }

    // 3. 调用 executeExecutorAgentWorkflow
    const engine = subtaskEngine as any;
    console.log('[ManualExecuteInsuranceD] 调用 executeExecutorAgentWorkflow...');
    await engine.executeExecutorAgentWorkflow(task);

    console.log('[ManualExecuteInsuranceD] ========== insurance-d 执行完成 ==========');

    // 4. 查询最新状态
    const updatedTask = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, task.id))
      .then(res => res[0]);

    return NextResponse.json({
      success: true,
      message: 'insurance-d 执行完成',
      task: updatedTask
    });

  } catch (error) {
    console.error('[ManualExecuteInsuranceD] 执行失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '执行失败' },
      { status: 500 }
    );
  }
}
