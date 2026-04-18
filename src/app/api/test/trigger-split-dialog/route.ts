/**
 * 手动触发拆解结果弹框的测试接口
 * POST /api/test/trigger-split-dialog
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentNotifications, dailyTask } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId = 'daily-task-insurance-d-2026-02-21-001' } = body;

    console.log('🔍 [测试] 开始手动触发拆解结果弹框...');
    console.log('🔍 [测试] taskId:', taskId);

    // 1. 查询 daily_task
    let tasks;
    try {
      tasks = await db
        .select()
        .from(dailyTask)
        .where(eq(dailyTask.taskId, taskId))
        .limit(1);
      console.log('🔍 [测试] 通过 task_id 查询结果:', tasks.length);
    } catch (error) {
      console.log('⚠️ [测试] 使用 task_id 查询失败:', error);
    }

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: '找不到 daily_task',
        debug: {
          taskId,
        },
      });
    }

    const dailyTask = tasks[0];
    console.log('✅ [测试] 找到 daily_task:', {
      id: dailyTask.id,
      taskId: dailyTask.taskId,
      executor: dailyTask.executor,
      executionStatus: dailyTask.executionStatus,
    });

    // 2. 查询相关通知
    const notifications = await db
      .select()
      .from(agentNotifications)
      .where(eq(agentNotifications.relatedTaskId, dailyTask.taskId))
      .limit(5);

    console.log('🔍 [测试] 找到通知数量:', notifications.length);
    notifications.forEach((n, i) => {
      console.log(`  📋 通知 ${i + 1}:`, {
        notificationId: n.notificationId,
        fromAgentId: n.fromAgentId,
        type: n.type,
        isRead: n.isRead,
        metadata: n.metadata,
      });
    });

    // 3. 重置第一个通知的状态，让它重新显示弹框
    if (notifications.length > 0) {
      const notification = notifications[0];
      console.log('🔄 [测试] 重置通知状态:', notification.notificationId);
      
      // 🔥 完全重置 metadata，删除所有相关字段
      const newMetadata = { ...(notification.metadata || {}) };
      delete newMetadata.splitPopupStatus;
      delete newMetadata.popupShownAt;
      delete newMetadata.confirmedAt;
      delete newMetadata.insuranceDSplitConfirmed;
      delete newMetadata.insuranceDSplitConfirmedAt;
      
      await db
        .update(agentNotifications)
        .set({
          isRead: false,
          metadata: newMetadata,
        })
        .where(eq(agentNotifications.id, notification.id));
      
      console.log('✅ [测试] 通知状态已完全重置');
    }

    return NextResponse.json({
      success: true,
      message: '已重置通知状态，刷新页面后应该会显示弹框',
      debug: {
        dailyTask: {
          id: dailyTask.id,
          taskId: dailyTask.taskId,
          executor: dailyTask.executor,
          executionStatus: dailyTask.executionStatus,
        },
        notifications: notifications.map(n => ({
          notificationId: n.notificationId,
          fromAgentId: n.fromAgentId,
          type: n.type,
          isRead: n.isRead,
          metadata: n.metadata,
        })),
      },
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
