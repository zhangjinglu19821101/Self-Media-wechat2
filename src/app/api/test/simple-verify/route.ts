import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/test/simple-verify
 * 简化验证 daily_task 表
 */
export async function GET() {
  try {
    // 简化查询，只查询基本列
    const result = await db.execute(
      sql`
        SELECT id, task_id, executor, execution_status, execution_date, created_at
        FROM daily_task
        LIMIT 5
      `
    );

    return NextResponse.json({
      success: true,
      count: result.length,
      tasks: result.map((t: any) => ({
        id: t.id,
        taskId: t.task_id,
        executor: t.executor,
        executionStatus: t.execution_status,
        executionDate: t.execution_date,
        createdAt: t.created_at,
      })),
    });
  } catch (error) {
    console.error('❌ 验证失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
