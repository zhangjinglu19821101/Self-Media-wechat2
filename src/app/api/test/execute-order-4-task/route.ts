/**
 * 手动执行 Agent T 处理 order_index=4 任务的测试接口
 */
import { NextRequest, NextResponse } from 'next/server';
import { subtaskEngine } from '@/lib/services/subtask-execution-engine';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { agentSubTasks } from '@/lib/db/schema';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

// 手动执行 Agent T 的 API 接口
export async function POST(request: NextRequest) {
  try {
    let { commandResultId } = await request.json().catch(() => ({}));

    if (!commandResultId) {
      return NextResponse.json({ error: '缺少 commandResultId 参数' }, { status: 400 });
    }

    console.log('[ExecuteOrder4Task] 开始执行 order_index=4', { commandResultId });

    // 获取 order_index=4 的任务
    const tasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.commandResultId, commandResultId));

    const task = tasks.find(t => t.orderIndex === 4);

    if (!task) {
      return NextResponse.json({ error: '未找到 order_index=4 的任务' }, { status: 404 });
    }

    console.log('[ExecuteOrder4Task] 找到任务:', {
      taskId: task.id,
      orderIndex: task.orderIndex,
      status: task.status,
      taskTitle: task.taskTitle
    });

    // 重置状态为 pending
    await db
      .update(agentSubTasks)
      .set({
        status: 'pending',
        updatedAt: getCurrentBeijingTime()
      })
      .where(eq(agentSubTasks.id, task.id));

    console.log('[ExecuteOrder4Task] 调用 executeAgentTExecutorWorkflow...');
    
    // 调用 Agent T 执行
    const engine = subtaskEngine as any;
    await engine.executeAgentTExecutorWorkflow(task);

    console.log('[ExecuteOrder4Task] ========== 执行完成 ==========');

    // 查询最新状态
    const updatedTask = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, task.id))
      .then(res => res[0]);

    return NextResponse.json({
      success: true,
      message: 'order_index=4 任务执行完成',
      task: updatedTask
    });

  } catch (error) {
    console.error('[ExecuteOrder4Task] 执行失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '执行失败' },
      { status: 500 }
    );
  }
}
