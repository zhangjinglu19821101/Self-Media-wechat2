/**
 * 手动修复子任务数据 API
 * POST /api/test/manual-fix-subtasks
 * 
 * 用于手动插入 agent_sub_tasks 数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask, agentSubTasks, agentNotifications } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const { notificationId } = await request.json();

    if (!notificationId) {
      return NextResponse.json(
        { success: false, error: '缺少 notificationId 参数' },
        { status: 400 }
      );
    }

    console.log(`🔧 开始手动修复子任务数据: notificationId=${notificationId}`);

    // 1. 查询通知
    const notifications = await db
      .select()
      .from(agentNotifications)
      .where(eq(agentNotifications.notificationId, notificationId))
      .limit(1);

    if (notifications.length === 0) {
      return NextResponse.json(
        { success: false, error: '通知不存在' },
        { status: 404 }
      );
    }

    const notification = notifications[0];
    console.log(`✅ 找到通知: ${notification.notificationId}`);

    // 2. 解析通知内容，获取子任务数据
    let contentJson;
    try {
      contentJson = JSON.parse(notification.content);
    } catch (e) {
      console.error('❌ 解析通知内容失败:', e);
      return NextResponse.json(
        { success: false, error: '通知内容格式错误' },
        { status: 400 }
      );
    }

    console.log('📋 通知内容解析成功');

    // 3. 获取子任务数据（兼容多种格式）
    let subTasks = [];
    let dailyTaskId = null;

    // 方式1: 从 metadata.pendingSubTasksByTask 获取
    if (notification.metadata?.pendingSubTasksByTask) {
      console.log('✅ 从 metadata.pendingSubTasksByTask 获取');
      const taskIds = Object.keys(notification.metadata.pendingSubTasksByTask);
      if (taskIds.length > 0) {
        dailyTaskId = taskIds[0];
        subTasks = notification.metadata.pendingSubTasksByTask[dailyTaskId];
      }
    }

    // 方式2: 从 content 中获取（批量拆解格式）
    if ((!subTasks || subTasks.length === 0) && contentJson?.splitResult?.tasks?.length > 0) {
      console.log('✅ 从 content.splitResult.tasks 获取（批量拆解格式）');
      const firstTask = contentJson.splitResult.tasks[0];
      subTasks = firstTask.subtasks || firstTask.subTasks || [];
      dailyTaskId = firstTask.taskId || firstTask.id;
    }

    // 方式3: 从 content.splitResult 获取
    if ((!subTasks || subTasks.length === 0) && contentJson?.splitResult) {
      console.log('✅ 从 content.splitResult 获取');
      subTasks = contentJson.splitResult.subtasks || contentJson.splitResult.subTasks || [];
    }

    if (!subTasks || subTasks.length === 0) {
      console.log('❌ 没有找到子任务数据');
      return NextResponse.json(
        { success: false, error: '没有找到子任务数据' },
        { status: 400 }
      );
    }

    console.log(`✅ 找到 ${subTasks.length} 个子任务`);

    // 4. 优先从 notification.relatedTaskId 查询正确的 daily_task
    if (notification.relatedTaskId) {
      console.log(`🔍 从 notification.relatedTaskId 查询: ${notification.relatedTaskId}`);
      
      // 查询 daily_task（用 task_id 查询）
      const tasks = await db
        .select()
        .from(dailyTask)
        .where(eq(dailyTask.taskId, notification.relatedTaskId))
        .limit(1);
      
      if (tasks.length > 0) {
        dailyTaskId = tasks[0].id;
        console.log(`✅ 找到 daily_task.id (UUID): ${dailyTaskId}`);
        console.log(`   task_id: ${tasks[0].taskId}`);
      }
    }

    if (!dailyTaskId) {
      return NextResponse.json(
        { success: false, error: '无法确定 dailyTaskId' },
        { status: 400 }
      );
    }

    // 5. 检查是否已经有子任务数据
    const existingSubTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.commandResultId, dailyTaskId));

    if (existingSubTasks.length > 0) {
      console.log(`⚠️ 已存在 ${existingSubTasks.length} 个子任务，跳过插入`);
      return NextResponse.json({
        success: true,
        message: '子任务已存在',
        data: {
          subTaskCount: existingSubTasks.length,
          skipped: true,
        },
      });
    }

    // 6. 插入子任务
    console.log(`💾 开始插入 ${subTasks.length} 个子任务...`);
    let insertedCount = 0;

    for (const subTask of subTasks) {
      await db.insert(agentSubTasks).values({
        commandResultId: dailyTaskId,
        agentId: subTask.executor || 'insurance-d',
        taskTitle: subTask.title || subTask.taskTitle,
        taskDescription: subTask.description || subTask.taskDescription,
        status: 'pending',
        orderIndex: subTask.orderIndex || subTask.order_index || insertedCount + 1,
        metadata: {
          acceptanceCriteria: subTask.acceptanceCriteria,
          isCritical: subTask.isCritical,
          criticalReason: subTask.criticalReason,
          executor: subTask.executor,
          deadline: subTask.deadline,
          priority: subTask.priority,
          estimatedHours: subTask.estimatedHours,
        },
      });
      insertedCount++;
      console.log(`   ✅ 插入子任务 ${insertedCount}: ${subTask.title || subTask.taskTitle}`);
    }

    // 7. 更新 daily_task 状态
    await db
      .update(dailyTask)
      .set({
        executionStatus: 'split_completed',
        updatedAt: new Date(),
        metadata: {
          subTaskCount: insertedCount,
          manualFixed: true,
          manualFixedAt: new Date().toISOString(),
        },
      })
      .where(eq(dailyTask.id, dailyTaskId));

    console.log(`✅ daily_task 状态已更新为 split_completed`);

    return NextResponse.json({
      success: true,
      message: `成功插入 ${insertedCount} 个子任务`,
      data: {
        subTaskCount: insertedCount,
        dailyTaskId,
      },
    });
  } catch (error) {
    console.error('❌ 手动修复失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/test/manual-fix-subtasks
 * 获取使用说明
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: '手动修复子任务数据 API',
    usage: {
      method: 'POST',
      endpoint: '/api/test/manual-fix-subtasks',
      body: {
        notificationId: 'notification-xxx',
      },
      example: `
curl -X POST http://localhost:5000/api/test/manual-fix-subtasks \\
  -H "Content-Type: application/json" \\
  -d '{"notificationId": "notification-18ba7e8f-37aa-47e5-8c79-0fb8e7fbe77f"}'
      `,
    },
  });
}
