/**
 * 检查 daily_task 表的详细信息
 * GET /api/test/check-daily-tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

export async function GET(request: NextRequest) {
  try {
    const sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 1,
    });

    console.log('🔍 [检查] 查询 daily_task 表详细信息...');

    const tasks = await sql`
      SELECT 
        id,
        task_id,
        task_title,
        executor,
        execution_status,
        question_status,
        execution_date,
        split_start_time,
        sub_task_count,
        created_at,
        updated_at
      FROM daily_task
      ORDER BY created_at DESC
      LIMIT 10
    `;

    console.log(`✅ [检查] 查询完成，共 ${tasks.length} 条记录`);

    // 分析问题
    const analysis = tasks.map((task, index) => {
      return {
        index,
        id: task.id,
        taskId: task.task_id,
        executor: task.executor,
        executionStatus: task.execution_status,
        questionStatus: task.question_status,
        hasQuestionStatusResolved: task.question_status === 'resolved',
        executionDate: task.execution_date,
        subTaskCount: task.sub_task_count,
        canBeProcessed: task.execution_status === 'pending_review' && task.question_status === 'resolved',
      };
    });

    await sql.end();

    return NextResponse.json({
      success: true,
      count: tasks.length,
      analysis,
      rawTasks: tasks,
    });
  } catch (error) {
    console.error('❌ [检查] 查询失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
