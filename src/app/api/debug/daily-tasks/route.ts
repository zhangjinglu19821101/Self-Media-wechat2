import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

/**
 * 查询 daily_task 表的详细数据
 * GET /api/debug/daily-tasks
 */
export async function GET(request: NextRequest) {
  try {
    const sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 10,
    });

    const tasks = await sql`
      SELECT id, task_id, related_task_id, task_title, executor, execution_status,
             execution_date, task_priority, created_at
      FROM daily_task
      ORDER BY created_at DESC
      LIMIT 10
    `;

    await sql.end();

    return NextResponse.json({
      success: true,
      data: {
        tasks,
        total: tasks.length,
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
