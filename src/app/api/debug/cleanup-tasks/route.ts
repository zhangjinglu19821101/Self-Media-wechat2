import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

/**
 * 清理测试数据
 * POST /api/debug/cleanup-tasks
 * Body: { dryRun?: boolean } // dryRun=true 时只返回要删除的数据，不实际删除
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const dryRun = body.dryRun === true;

    const sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 10,
    });

    console.log(`🧹 [cleanup] 开始${dryRun ? '模拟' : '执行'}清理数据`);

    // 1. 查询要删除的 agent_tasks
    const agentTasksToDelete = await sql`
      SELECT id, task_id, task_name, task_status, created_at
      FROM agent_tasks
      WHERE task_status IN ('split', 'completed', 'failed')
      ORDER BY created_at DESC
    `;

    console.log(`📊 [cleanup] 找到 ${agentTasksToDelete.length} 条已完成的 agent_tasks`);

    // 2. 查询要删除的 daily_task
    const dailyTaskToDelete = await sql`
      SELECT id, task_id, task_title, execution_status
      FROM daily_task
      WHERE execution_status IN ('completed', 'failed')
      ORDER BY created_at DESC
    `;

    console.log(`📊 [cleanup] 找到 ${dailyTaskToDelete.length} 条已完成的 daily_task`);

    // 3. 查询要删除的 agent_sub_tasks
    const subTasksToDelete = await sql`
      SELECT id, sub_task_id, task_status
      FROM agent_sub_tasks
      WHERE task_status IN ('completed', 'failed')
      ORDER BY created_at DESC
    `;

    console.log(`📊 [cleanup] 找到 ${subTasksToDelete.length} 条已完成的 agent_sub_tasks`);

    // 4. 查询要删除的 notifications
    const notificationsToDelete = await sql`
      SELECT id, notification_id, type, status
      FROM agent_notifications
      WHERE status IN ('completed', 'read')
      ORDER BY created_at DESC
    `;

    console.log(`📊 [cleanup] 找到 ${notificationsToDelete.length} 条已读/已完成的通知`);

    if (dryRun) {
      await sql.end();
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: '模拟清理完成（未实际删除）',
        data: {
          agentTasks: agentTasksToDelete.length,
          dailyTask: dailyTaskToDelete.length,
          subTasks: subTasksToDelete.length,
          notifications: notificationsToDelete.length,
        },
      });
    }

    // 5. 实际删除（按照外键依赖顺序：notifications -> agent_sub_tasks -> daily_task -> agent_tasks）
    let deletedCount = 0;

    // 删除 notifications
    if (notificationsToDelete.length > 0) {
      const ids = notificationsToDelete.map(n => n.id);
      await sql`DELETE FROM agent_notifications WHERE id IN ${sql(ids)}`;
      deletedCount += notificationsToDelete.length;
      console.log(`✅ [cleanup] 删除了 ${notificationsToDelete.length} 条 notifications`);
    }

    // 删除 agent_sub_tasks
    if (subTasksToDelete.length > 0) {
      const ids = subTasksToDelete.map(s => s.id);
      await sql`DELETE FROM agent_sub_tasks WHERE id IN ${sql(ids)}`;
      deletedCount += subTasksToDelete.length;
      console.log(`✅ [cleanup] 删除了 ${subTasksToDelete.length} 条 agent_sub_tasks`);
    }

    // 删除 daily_task
    if (dailyTaskToDelete.length > 0) {
      const ids = dailyTaskToDelete.map(d => d.id);
      await sql`DELETE FROM daily_task WHERE id IN ${sql(ids)}`;
      deletedCount += dailyTaskToDelete.length;
      console.log(`✅ [cleanup] 删除了 ${dailyTaskToDelete.length} 条 daily_task`);
    }

    // 删除 agent_tasks
    if (agentTasksToDelete.length > 0) {
      const ids = agentTasksToDelete.map(a => a.id);
      await sql`DELETE FROM agent_tasks WHERE id IN ${sql(ids)}`;
      deletedCount += agentTasksToDelete.length;
      console.log(`✅ [cleanup] 删除了 ${agentTasksToDelete.length} 条 agent_tasks`);
    }

    await sql.end();

    return NextResponse.json({
      success: true,
      message: `成功删除 ${deletedCount} 条记录`,
      data: {
        deleted: {
          agentTasks: agentTasksToDelete.length,
          dailyTask: dailyTaskToDelete.length,
          subTasks: subTasksToDelete.length,
          notifications: notificationsToDelete.length,
        },
        total: deletedCount,
      },
    });
  } catch (error) {
    console.error('❌ 清理失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
