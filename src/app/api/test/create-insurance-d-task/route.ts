import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentTasks } from '@/lib/db/schema';

/**
 * POST /api/test/create-insurance-d-task
 * 创建测试用的 insurance-d 任务
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      taskName = '保险科普文章创作（测试任务）',
      coreCommand = '创作10篇关于保险科普的文章，覆盖健康险、寿险、意外险、财产险等不同类型',
      acceptanceCriteria = '每篇文章字数800-1000字，内容准确、通俗易懂，适合普通大众阅读',
      totalDeliverables = '10篇保险科普文章',
      taskPriority = 'normal',
    } = body;

    // 生成任务ID
    const taskId = `task-A-to-insurance-d-${Date.now()}-${Math.random().toString(36).substr(2, 3)}`;

    // 设置任务周期（7天）
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1); // 从明天开始
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6); // 持续7天

    // 插入任务
    const insertedTasks = await db.insert(agentTasks).values({
      taskId,
      taskName: `任务拆解：${taskName}`,
      coreCommand,
      executor: 'insurance-d',
      acceptanceCriteria,
      taskType: 'master',
      splitStatus: 'pending_split',
      taskDurationStart: startDate,
      taskDurationEnd: endDate,
      totalDeliverables,
      taskPriority,
      taskStatus: 'pending',
      creator: 'A',
      updater: 'TS',
      fromAgentId: 'A',
      toAgentId: 'insurance-d',
      commandType: 'instruction',
      metadata: {
        taskType: 'article_creation', // 🔥 设置任务类型为文章创建，以便触发合规校验
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    console.log(`✅ 创建 insurance-d 测试任务成功: ${taskId}`);

    return NextResponse.json({
      success: true,
      message: '创建 insurance-d 测试任务成功',
      data: {
        taskId,
        taskName: insertedTasks[0].taskName,
        coreCommand: insertedTasks[0].coreCommand,
        executor: insertedTasks[0].executor,
        toAgentId: insertedTasks[0].toAgentId,
        taskDurationStart: insertedTasks[0].taskDurationStart,
        taskDurationEnd: insertedTasks[0].taskDurationEnd,
      },
    });
  } catch (error) {
    console.error('❌ 创建任务失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
