import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

/**
 * 更新 daily_task 的状态
 * POST /api/debug/update-task-status
 * Body: { taskId: string, newStatus: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, newStatus } = body;

    if (!taskId || !newStatus) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必填字段：taskId, newStatus',
        },
        { status: 400 }
      );
    }

    const sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 10,
    });

    console.log(`🔧 更新任务状态: ${taskId} -> ${newStatus}`);

    // 查询任务
    const tasks = await sql`
      SELECT id, task_id, task_title, execution_status
      FROM daily_task
      WHERE task_id = ${taskId}
    `;

    if (tasks.length === 0) {
      await sql.end();
      return NextResponse.json(
        {
          success: false,
          error: '任务不存在',
        },
        { status: 404 }
      );
    }

    const task = tasks[0];
    console.log(`📋 原状态: ${task.execution_status}`);

    // 更新状态
    const result = await sql`
      UPDATE daily_task
      SET execution_status = ${newStatus},
          retry_status = NULL,
          updated_at = ${new Date()}
      WHERE task_id = ${taskId}
      RETURNING *
    `;

    console.log(`✅ 更新成功:`, result[0].execution_status);

    await sql.end();

    return NextResponse.json({
      success: true,
      message: '任务状态更新成功',
      data: {
        oldStatus: task.execution_status,
        newStatus: result[0].execution_status,
      },
    });
  } catch (error) {
    console.error('❌ 更新失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
