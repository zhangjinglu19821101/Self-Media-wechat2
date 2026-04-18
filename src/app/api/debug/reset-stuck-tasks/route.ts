import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

export async function POST() {
  try {
    console.log('[Debug] 开始重置卡住的任务');

    const TEN_MINUTES = 10 * 60 * 1000;
    const now = getCurrentBeijingTime();
    const tenMinutesAgo = new Date(now.getTime() - TEN_MINUTES);

    // 查找所有超时的 in_progress 任务
    const stuckTasks = await db
      .select()
      .from(agentSubTasks)
      .where(
        and(
          eq(agentSubTasks.status, 'in_progress'),
          lt(agentSubTasks.startedAt, tenMinutesAgo)
        )
      );

    console.log(`[Debug] 找到 ${stuckTasks.length} 个卡住的任务`);

    const resetResults = [];

    for (const task of stuckTasks) {
      await db
        .update(agentSubTasks)
        .set({
          status: 'pending',
          startedAt: null,
          updatedAt: getCurrentBeijingTime(),
        })
        .where(eq(agentSubTasks.id, task.id));

      resetResults.push({
        id: task.id,
        taskTitle: task.taskTitle,
        orderIndex: task.orderIndex,
      });

      console.log(`[Debug] 已重置任务: ${task.id} - ${task.taskTitle}`);
    }

    return NextResponse.json({
      success: true,
      message: `已重置 ${resetResults.length} 个卡住的任务`,
      resetTasks: resetResults,
    });
  } catch (error) {
    console.error('[Debug] 重置卡住的任务失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
