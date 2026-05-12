/**
 * 测试 API：重置任务状态并触发 insurance-d 拆解
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask, agentNotifications } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { insuranceDBatchSplitTask } from '@/lib/services/task-assignment-service';

export async function GET(request: NextRequest) {
  try {
    console.log('🔧 [重置并触发拆解] 开始...');

    // 1. 查询 insurance-d 的任务
    console.log('📋 步骤 1: 查询 insurance-d 任务...');
    const tasks = await db
      .select()
      .from(dailyTask)
      .where(eq(dailyTask.executor, 'insurance-d'));

    console.log(`✅ 找到 ${tasks.length} 个 insurance-d 任务`);

    if (tasks.length === 0) {
      return NextResponse.json({
        success: false,
        message: '没有找到 insurance-d 任务',
      });
    }

    // 2. 选择一个任务进行重置
    const targetTask = tasks.find(t => t.taskId === 'daily-task-insurance-d-2026-02-24-003') || tasks[0];
    console.log(`🎯 选择任务: ${targetTask.taskId}`);

    // 3. 删除旧的拆解通知
    console.log('🗑️ 步骤 2: 删除旧的拆解通知...');
    const oldNotifications = await db
      .select()
      .from(agentNotifications)
      .where(
        and(
          eq(agentNotifications.toAgentId, 'A'),
          eq(agentNotifications.notificationType, 'insurance_d_split_result')
        )
      )
      .orderBy(desc(agentNotifications.createdAt))
      .limit(5);

    console.log(`🗑️ 找到 ${oldNotifications.length} 个旧通知`);

    for (const notif of oldNotifications) {
      await db
        .delete(agentNotifications)
        .where(eq(agentNotifications.id, notif.id));
      console.log(`   - 删除通知: ${notif.notificationId}`);
    }

    // 4. 重置任务状态
    console.log('🔄 步骤 3: 重置任务状态...');
    await db
      .update(dailyTask)
      .set({
        executionStatus: 'pending_review',
        subTaskCount: 0,
        metadata: {
          splitRejected: false,
          rejectionReason: null,
          splitResult: null,
        },
        updatedAt: new Date(),
      })
      .where(eq(dailyTask.id, targetTask.id));

    console.log(`✅ 任务 ${targetTask.taskId} 已重置为 pending_review`);

    // 5. 触发拆解
    console.log('🚀 步骤 4: 触发拆解...');
    const result = await insuranceDBatchSplitTask([targetTask.id]);

    console.log('✅ 拆解完成!');
    console.log('Result:', result);

    return NextResponse.json({
      success: true,
      message: '任务已重置并触发拆解',
      data: {
        taskId: targetTask.taskId,
        splitResult: result,
      },
    });
  } catch (error) {
    console.error('❌ 重置并触发拆解失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
