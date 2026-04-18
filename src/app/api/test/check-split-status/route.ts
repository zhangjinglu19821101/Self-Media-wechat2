import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentTasks } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // 查询最新的 insurance-d 任务
    const [latestTask] = await db
      .select()
      .from(agentTasks)
      .where(eq(agentTasks.executor, 'B'))
      .orderBy(desc(agentTasks.createdAt))
      .limit(1);

    if (!latestTask) {
      return NextResponse.json({
        success: false,
        message: '未找到任务',
      });
    }

    return NextResponse.json({
      success: true,
      taskId: latestTask.taskId,
      splitStatus: latestTask.splitStatus,
      taskStatus: latestTask.taskStatus,
      executor: latestTask.executor,
      createdAt: latestTask.createdAt,
      analysis: {
        canSplit: latestTask.splitStatus === 'pending_split' || latestTask.splitStatus === 'split_rejected',
        needsManualTrigger: true,
        reason: '系统没有自动触发拆解机制，需要手动调用拆解接口',
      },
    });
  } catch (error) {
    console.error('查询失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
