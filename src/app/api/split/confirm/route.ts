
/**
 * 统一拆解确认 API
 * 
 * 🔥 唯一正确的拆解确认入口！
 * 🔥 任何拆解都必须走这个 API！
 * 🔥 自动判断是 Agent B 还是 insurance-d
 * 🔥 统一走 agent_tasks -> daily_task -> agent_sub_tasks 流程
 * 
 * POST /api/split/confirm
 */

import { NextRequest, NextResponse } from 'next/server';
import { saveSplitResultToDailyTasks } from '@/lib/services/save-split-result-v2';
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
    const { 
      notificationId, 
      splitResult, 
      taskId,
      splitExecutor // 新增：明确指定拆解者
    } = body;

    console.log('🔴🔴🔴 [统一拆解确认] ===== 开始 =====');
    console.log('🔴🔴🔴 [统一拆解确认] notificationId:', notificationId);
    console.log('🔴🔴🔴 [统一拆解确认] taskId:', taskId);
    console.log('🔴🔴🔴 [统一拆解确认] splitExecutor:', splitExecutor);
    console.log('🔴🔴🔴 [统一拆解确认] splitResult:', JSON.stringify(splitResult, null, 2));

    // 1. 验证必填参数
    if (!splitResult || !taskId) {
      return NextResponse.json(
        { success: false, error: '缺少必填参数：splitResult 和 taskId' },
        { status: 400 }
      );
    }

    // 2. 第一步：保存到 daily_task 表
    console.log('🔴🔴🔴 [统一拆解确认] 第一步：保存到 daily_task 表...');
    
    const saveResult = await saveSplitResultToDailyTasks(taskId, splitResult);
    
    if (!saveResult.success) {
      console.error('🔴🔴🔴 [统一拆解确认] 保存到 daily_task 表失败:', saveResult.error);
      return NextResponse.json(saveResult, { status: 400 });
    }

    console.log('🔴🔴🔴 [统一拆解确认] 第一步成功:', saveResult);
    
    const dailyTaskId = saveResult.data?.dailyTaskId;
    if (!dailyTaskId) {
      console.error('🔴🔴🔴 [统一拆解确认] 未获取到 dailyTaskId');
      return NextResponse.json(
        { success: false, error: '保存流程异常，未获取到 dailyTaskId' },
        { status: 500 }
      );
    }

    // 3. 第二步：保存到 agent_sub_tasks 表
    console.log('🔴🔴🔴 [统一拆解确认] 第二步：保存到 agent_sub_tasks 表...');
    console.log('🔴🔴🔴 [统一拆解确认] 使用 dailyTaskId:', dailyTaskId);

    try {
      // 查询 daily_task
      const tasks = await sql`
        SELECT * FROM daily_task
        WHERE id = ${dailyTaskId} OR task_id = ${dailyTaskId}
        LIMIT 1;
      `;

      if (tasks.length === 0) {
        console.error('🔴🔴🔴 [统一拆解确认] 未找到 daily_task:', dailyTaskId);
        return NextResponse.json(
          { success: false, error: '未找到 daily_task 记录' },
          { status: 404 }
        );
      }

      const dailyTask = tasks[0];
      console.log('🔴🔴🔴 [统一拆解确认] 找到 daily_task:', dailyTask.id);

      // 防重检查
      if (dailyTask.execution_status === 'split_completed') {
        console.log('🔴🔴🔴 [统一拆解确认] 该任务已经拆解完成');
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
        console.log('🔴🔴🔴 [统一拆解确认] 该任务已经有子任务了');
        return NextResponse.json(
          { success: false, error: '该任务已经有子任务了', code: 'ALREADY_HAS_SUBTASKS' },
          { status: 409 }
        );
      }

      // 解析子任务
      const subTasks = splitResult?.subtasks || splitResult?.subTasks || [];
      if (subTasks.length === 0) {
        console.error('🔴🔴🔴 [统一拆解确认] 没有解析到有效的子任务');
        return NextResponse.json(
          { success: false, error: '没有解析到有效的子任务' },
          { status: 400 }
        );
      }

      console.log('🔴🔴🔴 [统一拆解确认] 解析到', subTasks.length, '个子任务');

      // 插入子任务
      const insertedIds: string[] = [];
      for (let i = 0; i < subTasks.length; i++) {
        const subTask = subTasks[i];
        const newSubTaskId = crypto.randomUUID();
        insertedIds.push(newSubTaskId);
        
        const taskTitle = subTask.taskName || subTask.title || subTask.name || `子任务 ${i + 1}`;
        const taskDescription = subTask.taskDescription || subTask.description || subTask.content || '';
        
        // 🔥 修复：正确设置 from_parents_executor 字段为 'agent B' 或 'agent T'
        // 优先使用 splitExecutor 参数，其次使用 subTask.executor，最后使用 dailyTask.executor
        let fromParentsExecutor = 'agent B'; // 默认值
        
        if (splitExecutor) {
          fromParentsExecutor = splitExecutor.toLowerCase().includes('t') ? 'agent T' : 'agent B';
        } else if (subTask.executor) {
          fromParentsExecutor = subTask.executor.toLowerCase().includes('t') ? 'agent T' : 'agent B';
        } else if (dailyTask.executor) {
          fromParentsExecutor = dailyTask.executor.toLowerCase().includes('t') ? 'agent T' : 'agent B';
        }
        
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

      console.log('🔴🔴🔴 [统一拆解确认] 成功插入', insertedIds.length, '个子任务');

      // 更新 daily_task 状态
      await sql`
        UPDATE daily_task
        SET 
          execution_status = ${'split_completed'},
          sub_task_count = ${subTasks.length},
          updated_at = NOW()
        WHERE id = ${dailyTask.id};
      `;

      console.log('🔴🔴🔴 [统一拆解确认] 更新 daily_task 状态为 split_completed');

      // 如果提供了 notificationId，标记通知为已读
      if (notificationId) {
        try {
          const notifications = await sql`
            SELECT * FROM agent_notifications
            WHERE notification_id = ${notificationId}
            LIMIT 1;
          `;

          if (notifications.length > 0) {
            await sql`
              UPDATE agent_notifications
              SET is_read = ${'true'}, read_at = NOW(), updated_at = NOW()
              WHERE notification_id = ${notificationId}
            `;
            console.log('🔴🔴🔴 [统一拆解确认] 标记通知为已读');
          }
        } catch (notifError) {
          console.log('🔴🔴🔴 [统一拆解确认] 标记通知失败，但主流程成功:', notifError);
        }
      }

      console.log('🔴🔴🔴 [统一拆解确认] ===== 成功完成 =====');

      return NextResponse.json({
        success: true,
        message: '拆解确认成功，已保存到 daily_task 和 agent_sub_tasks 表',
        data: {
          dailyTaskId: dailyTask.id,
          subTaskCount: subTasks.length,
          insertedIds,
        },
      });

    } catch (error) {
      console.error('🔴🔴🔴 [统一拆解确认] 第二步失败:', error);
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('🔴🔴🔴 [统一拆解确认] 整体失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '统一拆解确认失败' },
      { status: 500 }
    );
  } finally {
    await sql.end();
  }
}

