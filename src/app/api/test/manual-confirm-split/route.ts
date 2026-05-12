/**
 * 手动测试 confirm-split 接口
 * POST /api/test/manual-confirm-split
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask, agentSubTasks, agentNotifications } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [手动测试] 开始...');

    // 1. 查询任务
    const tasks = await db
      .select()
      .from(dailyTask)
      .where(eq(dailyTask.taskId, 'daily-task-insurance-d-2026-02-21-003'))
      .limit(1);

    if (tasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: '任务不存在',
      });
    }

    const dailyTask = tasks[0];
    console.log(`✅ 找到任务: id=${dailyTask.id}, task_id=${dailyTask.taskId}`);

    // 2. 查询最新的通知
    const notifications = await db
      .select()
      .from(agentNotifications)
      .where(eq(agentNotifications.title, 'insurance-d 批量拆解完成: 1 个任务 (2026-02-20, insurance-d)'))
      .limit(1);

    if (notifications.length === 0) {
      return NextResponse.json({
        success: false,
        error: '通知不存在',
      });
    }

    const notification = notifications[0];
    console.log(`✅ 找到通知: id=${notification.id}, notificationId=${notification.notificationId}`);

    // 3. 解析数据
    let contentObj: any = null;
    try {
      if (typeof notification.content === 'string') {
        contentObj = JSON.parse(notification.content);
      } else {
        contentObj = notification.content;
      }
    } catch (e) {
      console.error('❌ content 解析失败:', e);
    }

    const splitResult = contentObj?.splitResult;
    let subTasks: any[] = [];

    if (splitResult) {
      subTasks = splitResult.subtasks || splitResult.subTasks || [];
      
      if ((!subTasks || !Array.isArray(subTasks) || subTasks.length === 0) && 
          splitResult.tasks && Array.isArray(splitResult.tasks) && splitResult.tasks.length > 0) {
        console.log('🔍 批量拆解格式');
        const firstTask = splitResult.tasks[0];
        subTasks = firstTask.subtasks || firstTask.subTasks || [];
      }
    }

    console.log(`✅ 找到 ${subTasks.length} 个子任务`);

    if (subTasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: '没有找到子任务',
        debug: {
          hasContentObj: !!contentObj,
          hasSplitResult: !!splitResult,
        },
      });
    }

    // 4. 手动插入子任务（复制 confirm-split 的逻辑）
    console.log('💾 开始手动插入子任务...');
    let totalInserted = 0;

    for (const subTask of subTasks) {
      console.log(`   📝 插入子任务: ${subTask.title}`);
      try {
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
        console.log(`      ✅ 插入成功!`);
      } catch (insertError) {
        console.error(`      ❌ 插入失败:`, insertError);
        return NextResponse.json({
          success: false,
          error: '插入子任务失败',
          subTaskTitle: subTask.title,
          insertError: insertError instanceof Error ? insertError.message : String(insertError),
        });
      }
    }

    console.log(`✅ 总共插入 ${totalInserted} 个子任务`);

    // 5. 验证插入结果
    const savedSubTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.commandResultId, dailyTask.id));

    return NextResponse.json({
      success: true,
      message: '手动测试成功！',
      dailyTaskId: dailyTask.id,
      notificationId: notification.id,
      notificationNotificationId: notification.notificationId,
      subTasksFound: subTasks.length,
      insertedCount: totalInserted,
      savedCount: savedSubTasks.length,
      savedSubTasks: savedSubTasks.map(st => ({
        id: st.id,
        taskTitle: st.taskTitle,
        agentId: st.agentId,
      })),
    });
  } catch (error) {
    console.error('❌ [手动测试] 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
