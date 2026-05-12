import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

/**
 * 查询三个表的数据统计
 * GET /api/debug/check-tables
 */
export async function GET(request: NextRequest) {
  try {
    const sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 10,
    });

    // 1. agent_tasks 统计
    const agentTasksTotal = await sql`SELECT COUNT(*) as total FROM agent_tasks`;
    const agentTasksByStatus = await sql`
      SELECT task_status, COUNT(*) as count
      FROM agent_tasks
      GROUP BY task_status
      ORDER BY count DESC
    `;

    // 2. daily_task 统计
    const dailyTaskTotal = await sql`SELECT COUNT(*) as total FROM daily_task`;
    const dailyTaskByStatus = await sql`
      SELECT execution_status, COUNT(*) as count
      FROM daily_task
      GROUP BY execution_status
      ORDER BY count DESC
    `;

    // 3. agent_sub_tasks 统计
    const subTasksTotal = await sql`SELECT COUNT(*) as total FROM agent_sub_tasks`;
    const subTasksByStatus = await sql`
      SELECT status, COUNT(*) as count
      FROM agent_sub_tasks
      GROUP BY status
      ORDER BY count DESC
    `;

    // 4. agent_notifications 统计
    const notificationsTotal = await sql`SELECT COUNT(*) as total FROM agent_notifications`;
    const notificationsByStatus = await sql`
      SELECT status, COUNT(*) as count
      FROM agent_notifications
      GROUP BY status
      ORDER BY count DESC
    `;

    await sql.end();

    return NextResponse.json({
      success: true,
      data: {
        agent_tasks: {
          total: agentTasksTotal[0].total,
          byStatus: agentTasksByStatus,
        },
        daily_task: {
          total: dailyTaskTotal[0].total,
          byStatus: dailyTaskByStatus,
        },
        agent_sub_tasks: {
          total: subTasksTotal[0].total,
          byStatus: subTasksByStatus,
        },
        agent_notifications: {
          total: notificationsTotal[0].total,
          byStatus: notificationsByStatus,
        },
      },
    });
  } catch (error) {
    console.error('❌ 查询失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
