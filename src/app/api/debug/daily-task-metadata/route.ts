import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

/**
 * 查询 daily_task 的 metadata
 * GET /api/debug/daily-task-metadata?taskId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少 taskId 参数',
        },
        { status: 400 }
      );
    }

    const sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 10,
    });

    const tasks = await sql`
      SELECT id, task_id, task_title, execution_status, retry_status, metadata
      FROM daily_task
      WHERE task_id = ${taskId}
    `;

    await sql.end();

    if (tasks.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '任务不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: tasks[0],
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
