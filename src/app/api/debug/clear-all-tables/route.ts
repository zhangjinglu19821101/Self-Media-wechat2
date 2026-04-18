import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

/**
 * 清空所有相关表的数据
 * POST /api/debug/clear-all-tables
 *
 * 清空顺序（考虑外键约束）:
 * 1. agent_sub_tasks (子任务)
 * 2. daily_task (每日任务)
 * 3. agent_notifications (通知)
 * 4. agent_tasks (主任务)
 */
export async function POST(request: NextRequest) {
  try {
    const sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 10,
    });

    const results: { table: string; count: number }[] = [];

    // 1. 清空 agent_sub_tasks
    try {
      const subTasksResult = await sql`DELETE FROM agent_sub_tasks RETURNING COUNT(*) as count`;
      results.push({
        table: 'agent_sub_tasks',
        count: subTasksResult[0]?.count || 0,
      });
      console.log(`✅ 已清空 agent_sub_tasks，删除 ${results[0].count} 条记录`);
    } catch (error) {
      console.error('❌ 清空 agent_sub_tasks 失败:', error);
      results.push({ table: 'agent_sub_tasks', count: -1 });
    }

    // 2. 清空 daily_task
    try {
      const dailyTaskResult = await sql`DELETE FROM daily_task RETURNING COUNT(*) as count`;
      results.push({
        table: 'daily_task',
        count: dailyTaskResult[0]?.count || 0,
      });
      console.log(`✅ 已清空 daily_task，删除 ${results[1].count} 条记录`);
    } catch (error) {
      console.error('❌ 清空 daily_task 失败:', error);
      results.push({ table: 'daily_task', count: -1 });
    }

    // 3. 清空 agent_notifications
    try {
      const notificationsResult = await sql`DELETE FROM agent_notifications RETURNING COUNT(*) as count`;
      results.push({
        table: 'agent_notifications',
        count: notificationsResult[0]?.count || 0,
      });
      console.log(`✅ 已清空 agent_notifications，删除 ${results[2].count} 条记录`);
    } catch (error) {
      console.error('❌ 清空 agent_notifications 失败:', error);
      results.push({ table: 'agent_notifications', count: -1 });
    }

    // 4. 清空 agent_tasks
    try {
      const agentTasksResult = await sql`DELETE FROM agent_tasks RETURNING COUNT(*) as count`;
      results.push({
        table: 'agent_tasks',
        count: agentTasksResult[0]?.count || 0,
      });
      console.log(`✅ 已清空 agent_tasks，删除 ${results[3].count} 条记录`);
    } catch (error) {
      console.error('❌ 清空 agent_tasks 失败:', error);
      results.push({ table: 'agent_tasks', count: -1 });
    }

    await sql.end();

    return NextResponse.json({
      success: true,
      message: '已清空所有表数据',
      results,
      totalDeleted: results.reduce((sum, r) => sum + (r.count > 0 ? r.count : 0), 0),
    });
  } catch (error) {
    console.error('❌ 清空数据失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
