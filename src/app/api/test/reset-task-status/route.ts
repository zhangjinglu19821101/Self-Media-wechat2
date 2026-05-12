/**
 * 重置 daily_task 状态为 pending_review
 * POST /api/test/reset-task-status
 */

import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

export async function POST(request: NextRequest) {
  try {
    const sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 1,
    });

    console.log('🔍 [重置] 开始重置任务状态...');

    // 查询所有 splitting 状态的任务
    const tasks = await sql`
      SELECT 
        id,
        task_id,
        task_title,
        executor,
        execution_status
      FROM daily_task
      WHERE execution_status = 'splitting'
      ORDER BY created_at DESC
    `;

    console.log(`✅ [重置] 找到 ${tasks.length} 个 splitting 状态的任务`);

    // 重置为 pending_review
    let resetCount = 0;
    for (const task of tasks) {
      await sql`
        UPDATE daily_task
        SET 
          execution_status = 'pending_review',
          split_start_time = NULL,
          updated_at = NOW()
        WHERE id = ${task.id}
      `;
      
      console.log(`   ✅ 已重置: ${task.task_id} (${task.executor})`);
      resetCount++;
    }

    await sql.end();

    return NextResponse.json({
      success: true,
      message: `已重置 ${resetCount} 个任务状态为 pending_review`,
      resetCount,
      resetTasks: tasks.map(t => ({
        id: t.id,
        taskId: t.task_id,
        executor: t.executor,
      })),
    });
  } catch (error) {
    console.error('❌ [重置] 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
