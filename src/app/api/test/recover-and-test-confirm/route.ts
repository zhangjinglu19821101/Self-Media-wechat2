/**
 * 恢复 metadata 并重新测试确认流程 API
 * POST /api/test/recover-and-test-confirm
 * 
 * 用于恢复已丢失的 metadata 并重新触发确认流程
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask, agentSubTasks, agentNotifications } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const { notificationId } = await request.json();

    if (!notificationId) {
      return NextResponse.json(
        { success: false, error: '缺少 notificationId 参数' },
        { status: 400 }
      );
    }

    console.log(`🔄 开始恢复 metadata 并重新测试: notificationId=${notificationId}`);

    // ============================================
    // 步骤 1：查询通知
    // ============================================
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

    // ============================================
    // 步骤 2：从 content 中解析子任务数据
    // ============================================
    let contentJson = null;
    try {
      contentJson = typeof notification.content === 'string' 
        ? JSON.parse(notification.content) 
        : notification.content;
    } catch (e) {
      console.error('❌ 解析 content 失败:', e);
      return NextResponse.json(
        { success: false, error: '通知内容格式错误' },
        { status: 400 }
      );
    }

    if (!contentJson?.splitResult?.tasks || !Array.isArray(contentJson.splitResult.tasks)) {
      return NextResponse.json(
        { success: false, error: '找不到 splitResult.tasks 数据' },
        { status: 400 }
      );
    }

    console.log(`✅ 解析到 ${contentJson.splitResult.tasks.length} 个任务`);

    // ============================================
    // 步骤 3：为每个任务找到对应的 daily_task UUID
    // ============================================
    const pendingSubTasksByTask: Record<string, any[]> = {};
    const taskIdToUuidMap: Record<string, string> = {};

    for (const taskData of contentJson.splitResult.tasks) {
      // 通过 task_id 查询 daily_task 表获取 UUID
      const tasks = await db
        .select()
        .from(dailyTask)
        .where(eq(dailyTask.taskId, taskData.taskId))
        .limit(1);

      if (tasks.length > 0) {
        const taskUuid = tasks[0].id;
        taskIdToUuidMap[taskData.taskId] = taskUuid;
        
        const subTasks = taskData.subtasks || taskData.subTasks || [];
        pendingSubTasksByTask[taskUuid] = subTasks;
        
        console.log(`   ✅ 任务 ${taskData.taskId} -> UUID: ${taskUuid}, 子任务: ${subTasks.length}`);
      } else {
        console.log(`   ⚠️ 找不到任务: ${taskData.taskId}`);
      }
    }

    if (Object.keys(pendingSubTasksByTask).length === 0) {
      return NextResponse.json(
        { success: false, error: '没有找到有效的任务数据' },
        { status: 400 }
      );
    }

    // ============================================
    // 步骤 4：恢复 notification 的 metadata
    // ============================================
    const restoredMetadata = {
      ...(notification.metadata || {}),
      splitPopupStatus: null,  // 重置，让弹框可以重新显示
      confirmedAt: null,
      
      // 🔥 恢复关键数据
      pendingSubTasksByTask: pendingSubTasksByTask,
      pendingSubTasks: contentJson.splitResult.tasks.flatMap((t: any) => t.subtasks || t.subTasks || []),
      dailyTaskIds: Object.values(taskIdToUuidMap),
      taskId: contentJson.splitResult.tasks[0]?.taskId,
      subTaskCount: contentJson.splitResult.totalSubTasks,
      taskCount: contentJson.splitResult.taskCount,
      splitType: 'insurance_d_batch_split',
      date: contentJson.splitResult.date,
      executor: contentJson.splitResult.executor,
      originalTaskContent: contentJson.splitResult.tasks.map((t: any) => `${t.taskTitle || t.taskName || ''}`).join('\n\n'),
      originalTaskTitle: `${contentJson.splitResult.taskCount} 个任务 (${contentJson.splitResult.date}, ${contentJson.splitResult.executor})`,
    };

    await db
      .update(agentNotifications)
      .set({
        metadata: restoredMetadata,
        status: 'unread',  // 重置为未读
        isRead: false,
      })
      .where(eq(agentNotifications.notificationId, notificationId));

    console.log(`✅ notification metadata 已恢复`);

    // ============================================
    // 步骤 5：清理可能存在的旧子任务数据
    // ============================================
    for (const taskUuid of Object.keys(pendingSubTasksByTask)) {
      const existingSubTasks = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.commandResultId, taskUuid));

      if (existingSubTasks.length > 0) {
        console.log(`   ⚠️ 清理旧子任务: ${existingSubTasks.length} 条`);
        await db
          .delete(agentSubTasks)
          .where(eq(agentSubTasks.commandResultId, taskUuid));
      }
    }

    // ============================================
    // 步骤 6：直接插入子任务数据（绕过 confirm-split 接口）
    // ============================================
    console.log(`💾 直接插入子任务数据...`);
    let totalInserted = 0;

    for (const [taskUuid, subTasks] of Object.entries(pendingSubTasksByTask)) {
      console.log(`   📝 处理任务 ${taskUuid}: ${subTasks.length} 个子任务`);
      
      if (subTasks.length > 0) {
        for (const subTask of subTasks) {
          await db.insert(agentSubTasks).values({
            commandResultId: taskUuid,
            agentId: subTask.executor || 'insurance-d',
            taskTitle: subTask.title || subTask.taskTitle,
            taskDescription: subTask.description || subTask.taskDescription,
            status: 'pending',
            orderIndex: subTask.orderIndex || subTask.order_index || totalInserted + 1,
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
          totalInserted++;
          console.log(`      ✅ 插入子任务 ${totalInserted}: ${subTask.title || subTask.taskTitle}`);
        }
        console.log(`      ✅ 任务 ${taskUuid} 插入 ${subTasks.length} 个子任务`);
      }
    }

    // ============================================
    // 步骤 7：更新 daily_task 状态
    // ============================================
    for (const taskUuid of Object.keys(pendingSubTasksByTask)) {
      await db
        .update(dailyTask)
        .set({
          executionStatus: 'split_completed',
          retryStatus: null,
          updatedAt: new Date(),
          metadata: {
            insuranceDSplitConfirmed: true,
            insuranceDSplitConfirmedAt: new Date().toISOString(),
            splitNotificationId: notificationId,
            subTaskCount: pendingSubTasksByTask[taskUuid].length,
          },
        })
        .where(eq(dailyTask.id, taskUuid));
    }

    // ============================================
    // 步骤 8：重新标记 notification 为 confirmed
    // ============================================
    await db
      .update(agentNotifications)
      .set({
        metadata: {
          ...restoredMetadata,
          splitPopupStatus: 'confirmed',
          confirmedAt: new Date().toISOString(),
        },
      })
      .where(eq(agentNotifications.notificationId, notificationId));

    console.log(`✅ 完成！共插入 ${totalInserted} 个子任务`);

    return NextResponse.json({
      success: true,
      message: `成功恢复并插入 ${totalInserted} 个子任务`,
      data: {
        subTaskCount: totalInserted,
        taskCount: Object.keys(pendingSubTasksByTask).length,
        pendingSubTasksByTask: Object.fromEntries(
          Object.entries(pendingSubTasksByTask).map(([k, v]) => [k, (v as any[]).length])
        ),
      },
    });
  } catch (error) {
    console.error('❌ 恢复失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
