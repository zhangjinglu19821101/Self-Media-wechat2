import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

/**
 * 更新 daily_task 的执行日期
 * POST /api/debug/update-task-date
 * Body: { taskId: string, newExecutionDate: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, newExecutionDate } = body;

    if (!taskId || !newExecutionDate) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必填字段：taskId, newExecutionDate',
        },
        { status: 400 }
      );
    }

    const sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 10,
    });

    console.log(`🔧 更新任务执行日期: ${taskId} -> ${newExecutionDate}`);

    // 查询任务
    const tasks = await sql`
      SELECT id, task_id, task_title, execution_date, execution_deadline_start, execution_deadline_end
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
    console.log(`📋 原任务信息:`, task);

    // 更新执行日期和相关时间字段
    const executionDate = new Date(newExecutionDate);
    const deadlineStart = new Date(`${newExecutionDate} 09:00:00`);
    const deadlineEnd = new Date(`${newExecutionDate} 18:00:00`);

    const result = await sql`
      UPDATE daily_task
      SET execution_date = ${executionDate.toISOString().split('T')[0]},
          execution_deadline_start = ${deadlineStart},
          execution_deadline_end = ${deadlineEnd},
          updated_at = ${new Date()}
      WHERE task_id = ${taskId}
      RETURNING *
    `;

    console.log(`✅ 更新成功:`, result[0]);

    await sql.end();

    return NextResponse.json({
      success: true,
      message: '执行日期更新成功',
      data: {
        old: task,
        new: result[0],
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
