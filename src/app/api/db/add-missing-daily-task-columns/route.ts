import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * POST /api/db/add-missing-daily-task-columns
 * 添加 daily_task 表缺失的列
 */
export async function POST() {
  try {
    const columnsToAdd = [
      { name: 'task_title', type: 'TEXT NOT NULL DEFAULT \'\'' },
      { name: 'execution_date', type: 'DATE NOT NULL DEFAULT CURRENT_DATE' },
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

    // 更新 task_title 列，使用 command_content 的前 50 个字符
    try {
      await db.execute(
        sql`UPDATE daily_tasks SET task_title = SUBSTRING(task_description, 1, 50) WHERE task_title = ''`
      );
      console.log('✅ 更新 task_title 列');
    } catch (error) {
      console.log('⚠️  更新 task_title 失败:', error);
    }

    return NextResponse.json({
      success: true,
      message: '列添加完成',
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
