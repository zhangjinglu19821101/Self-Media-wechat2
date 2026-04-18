import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * POST /api/db/add-legacy-daily-task-columns
 * 添加 daily_task 表的旧版兼容字段
 */
export async function POST() {
  try {
    console.log('🔧 开始添加 daily_task 表的旧版兼容字段...');

    const columnsToAdd = [
      { name: 'command_id', type: 'TEXT UNIQUE' },
      { name: 'command_content', type: 'TEXT' },
      { name: 'command_priority', type: 'TEXT' },
      { name: 'original_command', type: 'TEXT' },
      { name: 'task_name', type: 'TEXT' },
      { name: 'trigger_source', type: 'TEXT' },
      { name: 'retry_status', type: 'TEXT' },
      { name: 'scenario_type', type: 'TEXT' },
    ];

    const addedColumns: string[] = [];

    for (const column of columnsToAdd) {
      try {
        await db.execute(
          sql`ALTER TABLE daily_task ADD COLUMN IF NOT EXISTS ${sql.raw(column.name)} ${sql.raw(column.type)}`
        );
        addedColumns.push(column.name);
        console.log(`✅ 添加列: ${column.name}`);
      } catch (error) {
        console.log(`⚠️  列 ${column.name} 可能已存在，跳过`);
      }
    }

    console.log(`✅ 完成！共添加 ${addedColumns.length} 个列`);

    return NextResponse.json({
      success: true,
      message: '旧版兼容字段添加完成',
      addedColumns,
    });
  } catch (error) {
    console.error('❌ 添加列失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
