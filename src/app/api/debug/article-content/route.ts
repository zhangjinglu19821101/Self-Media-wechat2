import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

/**
 * 查询 article_content 表的数据
 * GET /api/debug/article-content
 */
export async function GET(request: NextRequest) {
  try {
    const sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 10,
    });

    const { searchParams } = new URL(request.url);
    const commandResultId = searchParams.get('commandResultId') || '250d659b-2731-491f-95ce-e58a799829bb';

    console.log('[DEBUG] 查询 article_content 表, commandResultId:', commandResultId);

    const articleContents = await sql`
      SELECT *
      FROM article_content
      WHERE command_result_id = ${commandResultId}
      ORDER BY created_at DESC
      LIMIT 5
    `;

    console.log('[DEBUG] 查询结果数量:', articleContents.length);

    await sql.end();

    return NextResponse.json({
      success: true,
      data: {
        articleContents,
        total: articleContents.length,
        preview: articleContents.length > 0 ? {
          contentLength: articleContents[0].content?.length || 0,
          contentPreview: articleContents[0].content?.substring(0, 500) || ''
        } : null
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