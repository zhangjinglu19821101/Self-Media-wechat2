import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

/**
 * 清空所有测试数据（使用 TRUNCATE）
 * POST /api/debug/truncate-all
 */
export async function POST(request: NextRequest) {
  try {
    const sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 10,
    });

    console.log(`🧹 [truncate-all] 开始清理数据`);

    // 按照外键依赖顺序 TRUNCATE
    // 注意：TRUNCATE 会自动处理外键约束（使用 CASCADE）
    const tables = [
      'agent_sub_tasks',
      'daily_task',
      'agent_notifications',
      'agent_tasks',
    ];

    const results: any = {};

    for (const table of tables) {
      try {
        console.log(`🧹 [truncate-all] 清理表: ${table}`);
        await sql.unsafe(`TRUNCATE TABLE ${table} CASCADE`);
        console.log(`✅ [truncate-all] 清理完成: ${table}`);
        results[table] = 'success';
      } catch (error) {
        console.error(`❌ [truncate-all] 清理失败: ${table}`, error);
        results[table] = {
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    await sql.end();

    return NextResponse.json({
      success: true,
      message: '清理完成',
      data: results,
    });
  } catch (error) {
    console.error('❌ 清理失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
