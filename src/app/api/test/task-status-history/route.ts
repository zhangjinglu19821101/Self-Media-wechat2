import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    
    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    console.log('[TaskStatusHistory] 查询任务状态变化历史, taskId:', taskId);

    // 1. 查询任务基本信息
    const tasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, taskId));

    if (tasks.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const task = tasks[0];

    // 2. 查询该任务的所有历史记录
    const historyRecords = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, task.commandResultId),
          eq(agentSubTasksStepHistory.stepNo, task.orderIndex)
        )
      )
      .orderBy(desc(agentSubTasksStepHistory.interactTime));

    console.log('[TaskStatusHistory] 找到历史记录数量:', historyRecords.length);

    // 3. 分析状态变化
    const statusChanges = historyRecords.map((record, index) => {
      const content = record.interactContent as any;
      return {
        interactNum: record.interactNum,
        interactType: record.interactType,
        interactTime: record.interactTime,
        taskStatus: content?.task_status || content?.status || 'unknown',
        executionResult: content?.execution_result,
        question: content?.question ? {
          isCompleted: content.question.isCompleted,
          hasResult: !!content.question.result,
          hasSuggestion: !!content.question.suggestion,
        } : null,
        response: content?.response ? {
          hasDecision: !!content.response.decision,
          decisionType: content.response.decision?.type,
        } : null,
      };
    });

    return NextResponse.json({
      success: true,
      task: {
        id: task.id,
        title: task.taskTitle,
        orderIndex: task.orderIndex,
        currentStatus: task.status,
        fromParentsExecutor: task.fromParentsExecutor,
        commandResultId: task.commandResultId,
      },
      historyRecords: historyRecords.length,
      statusChanges,
      rawHistory: historyRecords,
    });

  } catch (error) {
    console.error('[TaskStatusHistory] 查询失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
