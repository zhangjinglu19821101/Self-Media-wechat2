/**
 * POST /api/agent-sub-tasks/confirm-split-fix
 * 修复版：Agent A 确认拆解结果，直接使用正确的数据库字段名
 *
 * 请求体：
 * {
 *   notificationId: "uuid",
 *   splitResult: {...},
 *   taskId: "daily-task-id"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

export async function POST(request: NextRequest) {
  const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { notificationId, splitResult, taskId } = body;

    // 🔥 超级详细的日志：打印接收到的所有参数
    console.log('🔴🔴🔴 [修复版] ===== 接收到的完整参数 =====');
    console.log('🔴🔴🔴 [修复版] 1. notificationId:', notificationId);
    console.log('🔴🔴🔴 [修复版] 2. notificationId 类型:', typeof notificationId);
    console.log('🔴🔴🔴 [修复版] 3. taskId:', taskId);
    console.log('🔴🔴🔴 [修复版] 4. taskId 类型:', typeof taskId);
    console.log('🔴🔴🔴 [修复版] 5. taskId 长度:', taskId?.length);
    console.log('🔴🔴🔴 [修复版] 6. splitResult 完整结构:', JSON.stringify(splitResult, null, 2));
    console.log('🔴🔴🔴 [修复版] ===== 参数接收完毕 =====');

    console.log(`🔴🔴🔴 [修复版] Agent A 确认拆解结果: taskId=${taskId}, notificationId=${notificationId}`);

    if (!notificationId || !splitResult || !taskId) {
      return NextResponse.json(
        { success: false, error: '缺少必填参数' },
        { status: 400 }
      );
    }

    // 1. 查询 daily_task
    let tasks = await sql`
      SELECT * FROM daily_task
      WHERE id = ${taskId} OR task_id = ${taskId}
      LIMIT 1;
    `;

    if (tasks.length === 0) {
      return NextResponse.json(
        { success: false, error: '任务不存在' },
        { status: 404 }
      );
    }

    const dailyTask = tasks[0];
    console.log(`✅ 找到 daily_task: id=${dailyTask.id}, task_id=${dailyTask.task_id}`);
    
    // 🔥 打印数据库实际字段对比
    console.log('🔴🔴🔴 [修复版] ===== daily_task 实际字段对比 =====');
    console.log('🔴🔴🔴 [修复版] daily_task 所有字段:', Object.keys(dailyTask));
    console.log('🔴🔴🔴 [修复版] daily_task.id (UUID):', dailyTask.id);
    console.log('🔴🔴🔴 [修复版] daily_task.task_id (业务ID):', dailyTask.task_id);
    console.log('🔴🔴🔴 [修复版] ===== 字段对比完毕 =====');

    // 防重检查
    if (dailyTask.execution_status === 'split_completed') {
      return NextResponse.json(
        { success: false, error: '该任务已经拆解完成', code: 'ALREADY_SPLIT_COMPLETED' },
        { status: 409 }
      );
    }

    // 检查是否已有子任务
    const existingSubTasks = await sql`
      SELECT * FROM agent_sub_tasks
      WHERE command_result_id = ${dailyTask.id}
      LIMIT 1;
    `;

    if (existingSubTasks.length > 0) {
      return NextResponse.json(
        { success: false, error: '该任务已经有子任务了', code: 'ALREADY_HAS_SUBTASKS' },
        { status: 409 }
      );
    }

    console.log(`✅ 防重检查通过`);

    // 2. 查询通知（使用正确的字段：notification_id 是 text 类型）
    let notifications = await sql`
      SELECT * FROM agent_notifications
      WHERE notification_id = ${notificationId}
      LIMIT 1;
    `;

    if (notifications.length === 0) {
      console.log(`⚠️ 未找到通知，但继续处理`);
    } else {
      console.log(`✅ 找到通知: id=${notifications[0].id}, notification_id=${notifications[0].notification_id}`);
    }

    // 3. 解析 splitResult
    let subTasksToInsert: any[] = [];
    
    try {
      const parseSplitResult = (data: any) => {
        if (data && typeof data === 'object') {
          if (data.subTasks && Array.isArray(data.subTasks)) {
            return data.subTasks;
          }
          if (data.tasks && Array.isArray(data.tasks)) {
            return data.tasks;
          }
          if (Array.isArray(data)) {
            return data;
          }
          if (data.steps && Array.isArray(data.steps)) {
            return data.steps;
          }
        }
        return [];
      };

      subTasksToInsert = parseSplitResult(splitResult);
      console.log(`✅ 解析到 ${subTasksToInsert.length} 个子任务`);
    } catch (e) {
      console.error(`❌ 解析 splitResult 失败:`, e);
      return NextResponse.json(
        { success: false, error: '解析拆解结果失败' },
        { status: 400 }
      );
    }

    if (subTasksToInsert.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有解析到有效的子任务' },
        { status: 400 }
      );
    }

    // 4. 插入子任务
    console.log(`🔄 开始插入 ${subTasksToInsert.length} 个子任务...`);
    
    const subTaskCount = subTasksToInsert.length;
    const insertedIds: string[] = [];

    for (let i = 0; i < subTasksToInsert.length; i++) {
      const subTask = subTasksToInsert[i];
      
      const newSubTaskId = crypto.randomUUID();
      insertedIds.push(newSubTaskId);
      
      const taskTitle = subTask.taskName || subTask.title || subTask.name || `子任务 ${i + 1}`;
      const taskDescription = subTask.taskDescription || subTask.description || subTask.content || '';
      const fromParentsExecutor = subTask.executor || dailyTask.executor || 'Agent B';
      
      // 🔥 修复：确保 executionDate 有值，使用 snake_case 字段名
      const executionDate = dailyTask.execution_date || dailyTask.executionDate || new Date().toISOString().split('T')[0];
      
      await sql`
        INSERT INTO agent_sub_tasks (
          id, command_result_id, from_parents_executor, task_title, task_description,
          status, order_index, execution_date, metadata, user_opinion, material_ids, workspace_id, created_at, updated_at
        ) VALUES (
          ${newSubTaskId},
          ${dailyTask.id},
          ${fromParentsExecutor},
          ${taskTitle},
          ${taskDescription},
          ${'pending'},
          ${i + 1},
          ${executionDate},
          ${JSON.stringify(subTask)},
          ${(dailyTask as any).user_opinion || (dailyTask as any).userOpinion || null},
          ${(dailyTask as any).material_ids || (dailyTask as any).materialIds || '[]'},
          ${authResult.workspaceId},
          NOW(),
          NOW()
        )
      `;
    }

    console.log(`✅ 成功插入 ${insertedIds.length} 个子任务`);

    // 5. 更新 daily_task 状态
    await sql`
      UPDATE daily_task
      SET 
        execution_status = ${'split_completed'},
        sub_task_count = ${subTaskCount},
        updated_at = NOW()
      WHERE id = ${dailyTask.id};
    `;

    console.log(`✅ 更新 daily_task 状态为 split_completed`);

    // 6. 标记通知为已读（使用 notification_id 字段，避免 UUID 问题）
    if (notifications.length > 0) {
      try {
        // 使用 notification_id 字段更新，而不是 id（UUID）
        await sql`
          UPDATE agent_notifications
          SET is_read = ${'true'}, read_at = NOW(), updated_at = NOW()
          WHERE notification_id = ${notificationId}
        `;
        console.log(`✅ 标记通知为已读`);
      } catch (notifError) {
        console.log(`⚠️ 标记通知失败，但主流程成功:`, notifError);
        // 通知更新失败不影响主流程
      }
    }

    return NextResponse.json({
      success: true,
      message: '拆解结果已确认',
      data: {
        subTaskCount,
        insertedIds
      }
    });

  } catch (error: any) {
    console.error('🔴 [修复版] 确认拆解失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '确认拆解失败' },
      { status: 500 }
    );
  } finally {
    await sql.end();
  }
}
