/**
 * 测试保存子任务的调试接口
 * POST /api/test/test-save-subtasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask, agentSubTasks, agentNotifications } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId = 'daily-task-insurance-d-2026-02-21-001' } = body;

    console.log('🔍 [测试] 开始测试子任务保存测试...');

    // 1. 查询 daily_task
    const tasks = await db
      .select()
      .from(dailyTask)
      .where(eq(dailyTask.taskId, taskId))
      .limit(1);

    if (tasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: '任务不存在',
      });
    }

    const dailyTask = tasks[0];
    console.log(`✅ 找到 daily_task: id=${dailyTask.id}, task_id=${dailyTask.taskId}`);

    // 2. 创建测试子任务数据
    const testSubTasks = [
      {
        orderIndex: 1,
        title: '测试子任务 1',
        description: '这是一个测试子任务 1',
        executor: 'insurance-d',
        deadline: '2026-02-20',
        priority: 'urgent',
        estimatedHours: 2,
        acceptanceCriteria: '测试验收标准 1',
        isCritical: true,
        criticalReason: '测试关键原因 1',
      },
      {
        orderIndex: 2,
        title: '测试子任务 2',
        description: '这是一个测试子任务 2',
        executor: 'insurance-d',
        deadline: '2026-02-20',
        priority: 'urgent',
        estimatedHours: 3,
        acceptanceCriteria: '测试验收标准 2',
        isCritical: true,
        criticalReason: '测试关键原因 2',
      },
    ];

    console.log('💾 开始插入测试子任务...');

    // 3. 插入子任务
    let totalInserted = 0;
    for (const subTask of testSubTasks) {
      await db.insert(agentSubTasks).values({
        commandResultId: dailyTask.id,
        agentId: subTask.executor,
        taskTitle: subTask.title,
        taskDescription: subTask.description,
        status: 'pending',
        orderIndex: subTask.orderIndex,
        metadata: {
          acceptanceCriteria: subTask.acceptanceCriteria,
          isCritical: subTask.isCritical,
          criticalReason: subTask.criticalReason,
          executor: subTask.executor,
        },
      });
      totalInserted++;
    }

    console.log(`✅ 插入了 ${totalInserted} 个测试子任务`);

    // 4. 查询验证子任务
    const savedSubTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.commandResultId, dailyTask.id));

    return NextResponse.json({
      success: true,
      message: `测试成功！插入了 ${totalInserted} 个子任务`,
      dailyTaskId: dailyTask.id,
      dailyTaskTaskId: dailyTask.taskId,
      insertedCount: totalInserted,
      savedSubTasks: savedSubTasks.map(st => ({
        id: st.id,
        taskTitle: st.taskTitle,
        agentId: st.agentId,
        status: st.status,
      })),
    });
  } catch (error) {
    console.error('❌ [测试] 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
