import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

/**
 * 查询待拆解的 daily_task
 * GET /api/debug/daily-tasks-split-status
 */
export async function GET(request: NextRequest) {
  try {
    const sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 10,
    });

    // 查询条件：符合 insurance-d 拆解条件的任务
    // 1. executor = 'insurance-d'
    // 2. execution_date <= 当前日期
    // 3. execution_status = 'new'
    // 4. retry_status IS NULL OR retry_status = 'new'
    const today = new Date().toISOString().split('T')[0];

    const tasks = await sql`
      SELECT id, task_id, task_title, executor, execution_date, execution_status,
             retry_status, sub_task_count, created_at
      FROM daily_task
      WHERE executor = 'insurance-d'
        AND execution_date <= ${today}
        AND execution_status = 'new'
        AND (retry_status IS NULL OR retry_status = 'new')
      ORDER BY execution_date
      LIMIT 10
    `;

    await sql.end();

    return NextResponse.json({
      success: true,
      data: {
        currentDate: today,
        condition: {
          executor: 'insurance-d',
          execution_date: `<= ${today}`,
          execution_status: 'new',
          retry_status: 'NULL OR new',
        },
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
