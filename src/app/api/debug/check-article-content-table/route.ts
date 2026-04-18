import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

/**
 * 查询 article_content 表结构
 * GET /api/debug/check-article-content-table
 */
export async function GET(request: NextRequest) {
  try {
    const sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 10,
    });

    console.log('[DEBUG] 查询 article_content 表结构...');

    // 查询表结构
    const tableInfo = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'article_content'
      ORDER BY ordinal_position
    `;

    console.log('[DEBUG] 表结构:', tableInfo);

    // 查询一些数据
    const sampleData = await sql`
      SELECT *
      FROM article_content
      ORDER BY created_at DESC
      LIMIT 3
    `;

    console.log('[DEBUG] 样本数据数量:', sampleData.length);

    await sql.end();

    return NextResponse.json({
      success: true,
      data: {
        tableStructure: tableInfo,
        sampleData: sampleData,
        sampleDataPreview: sampleData.length > 0 ? Object.keys(sampleData[0]) : []
      },
    });
  } catch (error) {
    console.error('❌ 查询失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}