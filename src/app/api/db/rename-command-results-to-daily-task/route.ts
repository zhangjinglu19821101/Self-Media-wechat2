import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';

/**
 * POST /api/db/rename-command-results-to-daily-task
 * 数据库迁移：重命名 command_results 表为 daily_task
 *
 * 注意：
 * 1. 这是一个破坏性操作，会重命名表
 * 2. 执行前请备份数据库
 * 3. 确保没有正在使用 command_results 表的服务
 */
export async function POST(request: NextRequest) {
  try {
    const { force = false } = await request.json();

    if (!force) {
      return NextResponse.json({
        success: false,
        error: '请设置 force=true 来确认执行此迁移操作',
        warning: '这是一个破坏性操作，会重命名 command_results 表为 daily_task',
      }, { status: 400 });
    }

    const { db } = await import('@/lib/db');

    // 检查表是否存在
    const checkTableExists = await db.execute(
      sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'command_results'`
    );

    if (!checkTableExists || checkTableExists.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'command_results 表不存在，可能已经迁移过了',
      }, { status: 404 });
    }

    // 检查 daily_task 表是否已存在
    const checkDailyTaskExists = await db.execute(
      sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'daily_task'`
    );

    if (checkDailyTaskExists && checkDailyTaskExists.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'daily_task 表已存在，无法重复迁移',
      }, { status: 409 });
    }

    // 重命名表
    await db.execute(sql`ALTER TABLE command_results RENAME TO daily_task`);

    // 添加新的日期列（如果不存在）
    try {
      await db.execute(sql`
        ALTER TABLE daily_task
        ADD COLUMN IF NOT EXISTS execution_date DATE NOT NULL DEFAULT CURRENT_DATE
      `);
    } catch (error) {
      console.log('⚠️  execution_date 列可能已存在，跳过');
    }

    // 重命名字段（可选）
    try {
      await db.execute(sql`ALTER TABLE daily_task RENAME COLUMN command_id TO task_id`);
    } catch (error) {
      console.log('⚠️  command_id 列可能已不存在或已重命名');
    }

    try {
      await db.execute(sql`ALTER TABLE daily_task RENAME COLUMN command_content TO task_description`);
    } catch (error) {
      console.log('⚠️  command_content 列可能已不存在或已重命名');
    }

    try {
      await db.execute(sql`ALTER TABLE daily_task RENAME COLUMN command_priority TO task_priority`);
    } catch (error) {
      console.log('⚠️  command_priority 列可能已不存在或已重命名');
    }

    console.log('✅ 数据库迁移完成：command_results → daily_task');

    return NextResponse.json({
      success: true,
      message: '数据库迁移完成',
      changes: {
        oldTable: 'command_results',
        newTable: 'daily_task',
      },
    });
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

/**
 * GET /api/db/rename-command-results-to-daily-task
 * 检查迁移状态
 */
export async function GET() {
  try {
    const { db } = await import('@/lib/db');

    const checkOldTable = await db.execute(
      sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'command_results'`
    );

    const checkNewTable = await db.execute(
      sql`SELECT table_name FROM information_schema.tables WHERE table_name = 'daily_task'`
    );

    return NextResponse.json({
      success: true,
      status: {
        oldTableExists: checkOldTable && checkOldTable.length > 0,
        newTableExists: checkNewTable && checkNewTable.length > 0,
        migrated: checkNewTable && checkNewTable.length > 0 && (!checkOldTable || checkOldTable.length === 0),
      },
    });
  } catch (error) {
    console.error('❌ 检查迁移状态失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
