/**
 * 列出数据库所有表
 * GET /api/test/list-tables
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

    console.log('🔍 [检查] 列出所有表...');

    // 查询所有表
    const tables = await sql`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;

    console.log(`✅ [检查] 找到 ${tables.length} 个表`);

    await sql.end();

    return NextResponse.json({
      success: true,
      count: tables.length,
      tables: tables.map(t => t.tablename),
    });
  } catch (error) {
    console.error('❌ [检查] 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
