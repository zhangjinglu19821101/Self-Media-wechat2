import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/test/check-daily-task-columns
 * 检查 daily_task 表的列结构
 */
export async function GET() {
  try {
    const columns = await db.execute(
      sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'daily_task'
        ORDER BY ordinal_position
      `
    );

    return NextResponse.json({
      success: true,
      columns: columns.map((col: any) => ({
        columnName: col.column_name,
        dataType: col.data_type,
        isNullable: col.is_nullable,
      })),
    });
  } catch (error) {
    console.error('❌ 检查失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
