/**
 * 查询 daily_task 表数据
 * GET /api/test/query-daily-tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

export async function GET(request: NextRequest) {
  try {
    const sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 1,
    });

    console.log('🔍 查询 daily_task 表数据...');

    // 查询所有 daily_task 数据，按创建时间倒序
    const tasks = await sql`
      SELECT 
        id,
        task_id,
        task_title,
        executor,
        execution_status,
        execution_date,
        split_start_time,
        created_at,
        updated_at
      FROM daily_task
      ORDER BY created_at DESC
      LIMIT 20
    `;

    console.log(`✅ 查询完成，共 ${tasks.length} 条记录`);

    await sql.end();

    return NextResponse.json({
      success: true,
      count: tasks.length,
      tasks: tasks.map(task => ({
        id: task.id,
        taskId: task.task_id,
        taskTitle: task.task_title,
        executor: task.executor,
        executionStatus: task.execution_status,
        executionDate: task.execution_date,
        splitStartTime: task.split_start_time,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
      })),
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
