import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { subtaskEngine } from '@/lib/services/subtask-execution-engine';

export async function GET(request: NextRequest) {
  try {
    console.log('[Manual Execute] 开始手动执行 order_index=2 的任务');

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
    console.log('[Manual Execute] 找到任务:', {
      id: task.id,
      commandResultId: task.commandResultId,
      status: task.status,
      taskTitle: task.taskTitle
    });

    // 2. 备份当前的 step history 记录
    const existingHistory = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(and(
        eq(agentSubTasksStepHistory.commandResultId, task.commandResultId),
        eq(agentSubTasksStepHistory.stepNo, 2)
      ))
      .orderBy(agentSubTasksStepHistory.id);

    console.log('[Manual Execute] 备份现有 history 记录:', existingHistory.length, '条');

    // 3. 重置任务状态为 pending
    await db
      .update(agentSubTasks)
      .set({
        status: 'pending',
        resultData: null,
        updatedAt: new Date()
      })
      .where(eq(agentSubTasks.id, task.id));

    console.log('[Manual Execute] 任务状态已重置为 pending');

    // 4. 手动调用 Agent T 执行（使用类型断言访问私有方法）
    console.log('[Manual Execute] 开始调用 Agent T 执行...');
    
    // @ts-ignore - 访问私有方法
    await subtaskEngine.executeAgentTExecutorWorkflow(task);

    console.log('[Manual Execute] Agent T 执行完成');

    // 5. 查询更新后的任务状态
    const updatedTask = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, task.id))
      .limit(1)
      .then(res => res[0]);

    // 6. 查询新的 step history 记录
    const newHistory = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(and(
        eq(agentSubTasksStepHistory.commandResultId, task.commandResultId),
        eq(agentSubTasksStepHistory.stepNo, 2)
      ))
      .orderBy(agentSubTasksStepHistory.id);

    console.log('[Manual Execute] 新的 history 记录:', newHistory.length, '条');

    // 7. 生成执行报告
    const report = {
      success: true,
      message: '手动执行完成',
      task: {
        id: updatedTask?.id,
        status: updatedTask?.status,
        resultData: updatedTask?.resultData
      },
      history: {
        beforeCount: existingHistory.length,
        afterCount: newHistory.length,
        newRecords: newHistory.map(h => ({
          id: h.id,
          interactUser: h.interactUser,
          interactType: h.interactType,
          interactNum: h.interactNum
        }))
      }
    };

    console.log('[Manual Execute] 执行报告:', JSON.stringify(report, null, 2));

    return NextResponse.json(report);

  } catch (error) {
    console.error('[Manual Execute] 手动执行失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}
