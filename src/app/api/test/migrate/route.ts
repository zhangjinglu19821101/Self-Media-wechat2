import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    console.log('开始执行数据库迁移...');

    // 检查字段是否已存在
    const columns = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'agent_sub_tasks'
      AND column_name IN ('execution_result', 'status_proof')
    `);

    const existingColumns: string[] = [];
    if (Array.isArray(columns)) {
      columns.forEach((col: any) => {
        if (col.column_name) {
          existingColumns.push(col.column_name);
        }
      });
    }

    const migrations: string[] = [];

    if (!existingColumns.includes('execution_result')) {
      await db.execute(sql`ALTER TABLE agent_sub_tasks ADD COLUMN execution_result TEXT`);
      migrations.push('✅ 已添加 execution_result 字段');
    } else {
      migrations.push('⏭️ execution_result 字段已存在');
    }

    if (!existingColumns.includes('status_proof')) {
      await db.execute(sql`ALTER TABLE agent_sub_tasks ADD COLUMN status_proof TEXT`);
      migrations.push('✅ 已添加 status_proof 字段');
    } else {
      migrations.push('⏭️ status_proof 字段已存在');
    }

    return NextResponse.json({
      success: true,
      message: '数据库迁移完成',
      migrations,
      existingColumns,
    });
  } catch (error) {
    console.error('数据库迁移失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
