import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentTasks } from '@/lib/db/schema';
import { desc, like } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // 查询最新的 insurance-d 相关任务
    const latestTask = await db
      .select()
      .from(agentTasks)
      .where(like(agentTasks.coreCommand, '%保险科普%'))
      .orderBy(desc(agentTasks.createdAt))
      .limit(1);

    if (latestTask.length === 0) {
      return NextResponse.json({
        success: false,
        message: '未找到相关任务',
      });
    }

    const task = latestTask[0];

    return NextResponse.json({
      success: true,
      task: {
        taskId: task.taskId,
        taskName: task.taskName,
        executor: task.executor,
        status: task.taskStatus,
        priority: task.taskPriority,
        coreCommand: task.coreCommand,
        acceptanceCriteria: task.acceptanceCriteria,
        taskType: task.taskType,
        splitStatus: task.splitStatus,
        fromAgentId: task.fromAgentId,
        toAgentId: task.toAgentId,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        taskDurationStart: task.taskDurationStart,
        taskDurationEnd: task.taskDurationEnd,
        totalDeliverables: task.totalDeliverables,
        metadata: task.metadata,
      },
      message: `✅ 找到最新任务，创建于 ${task.createdAt}`,
    });
  } catch (error) {
    console.error('查询失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
