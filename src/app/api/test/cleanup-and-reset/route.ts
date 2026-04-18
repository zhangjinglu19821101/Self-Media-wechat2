/**
 * 清理测试数据并重置新通知
 * POST /api/test/cleanup-and-reset
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, dailyTask, agentNotifications } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [清理] 开始清理测试数据...');

    // 1. 删除测试子任务
    const deletedSubTasks = await db
      .delete(agentSubTasks)
      .where(eq(agentSubTasks.taskTitle, '测试子任务 1'))
      .returning();

    console.log(`✅ 删除了 ${deletedSubTasks.length} 个测试子任务`);

    // 2. 删除刚才的通知
    const deletedNotifications = await db
      .delete(agentNotifications)
      .where(eq(agentNotifications.title, 'insurance-d 批量拆解完成: 1 个任务 (2026-02-21, insurance-d)'))
      .returning();

    console.log(`✅ 删除了 ${deletedNotifications.length} 个测试通知`);

    // 3. 重置任务状态
    const updatedTasks = await db
      .update(dailyTask)
      .set({
        executionStatus: 'pending_review',
        splitStartTime: null,
        updatedAt: new Date(),
      })
      .where(eq(dailyTask.taskId, 'daily-task-insurance-d-2026-02-21-003'))
      .returning();

    console.log(`✅ 重置了 ${updatedTasks.length} 个任务状态`);

    return NextResponse.json({
      success: true,
      message: '测试数据已清理！现在可以重新测试！',
      deletedSubTasksCount: deletedSubTasks.length,
      deletedNotificationsCount: deletedNotifications.length,
      updatedTasksCount: updatedTasks.length,
    });
  } catch (error) {
    console.error('❌ [清理] 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
