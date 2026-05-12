/**
 * 调试 confirm-split 接口
 * POST /api/test/debug-confirm-split
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask, agentSubTasks, agentNotifications } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, notificationId } = body;

    console.log('🔍 [调试] 开始测试 confirm-split 逻辑...');

    // 1. 查询任务
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
    console.log(`✅ 找到任务: id=${dailyTask.id}, task_id=${dailyTask.taskId}`);

    // 2. 查询通知
    const notifications = await db
      .select()
      .from(agentNotifications)
      .where(eq(agentNotifications.id, notificationId))
      .limit(1);

    if (notifications.length === 0) {
      return NextResponse.json({
        success: false,
        error: '通知不存在',
      });
    }

    const notification = notifications[0];
    console.log(`✅ 找到通知: ${notification.notificationId}`);

    // 3. 解析通知 content
    let contentObj: any = null;
    try {
      if (typeof notification.content === 'string') {
        contentObj = JSON.parse(notification.content);
      } else {
        contentObj = notification.content;
      }
    } catch (e) {
      console.error('❌ 解析 content 失败:', e);
    }

    console.log('📋 content 解析结果:', contentObj ? Object.keys(contentObj) : 'null');

    // 4. 获取子任务
    let subTasks: any[] = [];
    const splitResult = contentObj?.splitResult;

    if (splitResult) {
      console.log('📋 splitResult 存在，检查子任务...');
      console.log('  - splitResult.subtasks:', !!splitResult.subtasks);
      console.log('  - splitResult.subTasks:', !!splitResult.subTasks);
      console.log('  - splitResult.tasks:', !!splitResult.tasks);

      subTasks = splitResult.subtasks || splitResult.subTasks || [];

      if ((!subTasks || !Array.isArray(subTasks) || subTasks.length === 0) && 
          splitResult.tasks && Array.isArray(splitResult.tasks) && splitResult.tasks.length > 0) {
        console.log('🔍 [批量拆解] 从 tasks[0].subTasks 获取');
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
          hasContent: !!contentObj,
          hasSplitResult: !!splitResult,
          splitResultKeys: splitResult ? Object.keys(splitResult) : [],
        },
      });
    }

    // 5. 尝试插入一个测试子任务
    console.log('💾 开始插入测试子任务...');
    const testSubTask = subTasks[0];

    try {
      const inserted = await db.insert(agentSubTasks).values({
        commandResultId: dailyTask.id,
        agentId: testSubTask.executor,
        taskTitle: testSubTask.title,
        taskDescription: testSubTask.description,
        status: 'pending',
        orderIndex: testSubTask.orderIndex,
        metadata: {
          acceptanceCriteria: testSubTask.acceptanceCriteria,
          isCritical: testSubTask.isCritical,
          criticalReason: testSubTask.criticalReason,
          executor: testSubTask.executor,
        },
      });

      console.log('✅ 测试子任务插入成功!');
    } catch (insertError) {
      console.error('❌ 插入子任务失败:', insertError);
      return NextResponse.json({
        success: false,
        error: '插入子任务失败',
        insertError: insertError instanceof Error ? insertError.message : String(insertError),
      });
    }

    // 6. 查询验证
    const savedSubTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.commandResultId, dailyTask.id));

    return NextResponse.json({
      success: true,
      message: '调试成功！',
      dailyTask: {
        id: dailyTask.id,
        taskId: dailyTask.taskId,
      },
      notification: {
        id: notification.notificationId,
      },
      subTasksFound: subTasks.length,
      savedSubTasksCount: savedSubTasks.length,
      savedSubTasks: savedSubTasks.map(st => ({
        id: st.id,
        taskTitle: st.taskTitle,
        agentId: st.agentId,
      })),
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
