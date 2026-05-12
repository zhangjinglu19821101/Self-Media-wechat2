/**
 * 测试完整的子任务执行工作流
 * POST /api/test/subtask-workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    console.log('🔔 [测试] 开始测试完整工作流...');

    const { subtaskId } = await request.json();

    if (!subtaskId) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少 subtaskId 参数',
        },
        { status: 400 }
      );
    }

    // 查询子任务
    const tasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, subtaskId))
      .limit(1);

    if (tasks.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `子任务 ${subtaskId} 不存在`,
        },
        { status: 404 }
      );
    }

    const task = tasks[0];
    console.log(`[测试] 找到子任务: ${task.taskTitle}`);

    // 导入并执行完整工作流
    const { SubtaskExecutionEngine } = await import('@/lib/services/subtask-execution-engine');
    const engine = new SubtaskExecutionEngine();

    // 直接调用完整工作流
    // @ts-ignore - 我们知道这个私有方法存在
    await engine.executeCompleteWorkflow(task);

    return NextResponse.json({
      success: true,
      message: '完整工作流执行完成',
      data: {
        taskId: task.id,
        taskTitle: task.taskTitle,
      },
    });
  } catch (error) {
    console.error('❌ [测试] 执行失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '执行失败',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    name: 'subtask-workflow',
    description: '测试完整的子任务执行工作流',
    usage: {
      method: 'POST',
      endpoint: '/api/test/subtask-workflow',
      body: {
        subtaskId: '子任务ID',
      },
    },
  });
}
