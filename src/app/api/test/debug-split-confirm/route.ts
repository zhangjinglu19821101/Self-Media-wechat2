/**
 * 调试拆解确认流程的接口
 * POST /api/test/debug-split-confirm
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask, agentNotifications } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId } = body;

    console.log('🔍 [调试] 开始调试拆解确认流程...');
    console.log('🔍 [调试] taskId:', taskId);

    // 1. 查询 daily_task
    let tasks;
    try {
      tasks = await db
        .select()
        .from(dailyTask)
        .where(eq(dailyTask.id, taskId))
        .limit(1);
      console.log('🔍 [调试] 通过 id 查询结果:', tasks.length);
    } catch (error) {
      console.log('⚠️ [调试] 使用 id 查询失败:', error);
    }

    if (!tasks || tasks.length === 0) {
      try {
        tasks = await db
          .select()
          .from(dailyTask)
          .where(eq(dailyTask.taskId, taskId))
          .limit(1);
        console.log('🔍 [调试] 通过 task_id 查询结果:', tasks.length);
      } catch (error) {
        console.log('⚠️ [调试] 使用 task_id 查询也失败:', error);
      }
    }

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: '找不到 daily_task',
        debug: {
          taskId,
          taskIdType: typeof taskId,
          taskIdLength: taskId?.length,
        },
      });
    }

    const dailyTask = tasks[0];
    console.log('✅ [调试] 找到 daily_task:', {
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

    console.log('🔍 [调试] 找到通知数量:', notifications.length);
    notifications.forEach((n, i) => {
      console.log(`  📋 通知 ${i + 1}:`, {
        notificationId: n.notificationId,
        fromAgentId: n.fromAgentId,
        type: n.type,
        hasResult: !!n.result,
        hasContent: !!n.content,
        metadata: n.metadata,
      });
    });

    return NextResponse.json({
      success: true,
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
          metadata: n.metadata,
        })),
      },
    });
  } catch (error) {
    console.error('❌ [调试] 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
