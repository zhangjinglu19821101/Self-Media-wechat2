import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

/**
 * 查询 agent_sub_tasks 表的详细数据
 * GET /api/debug/agent-sub-tasks
 */
export async function GET(request: NextRequest) {
  try {
    const sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 10,
    });

    const subTasks = await sql`
      SELECT *
      FROM agent_sub_tasks
      ORDER BY created_at DESC
      LIMIT 15
    `;

    await sql.end();

    return NextResponse.json({
      success: true,
      data: {
        subTasks,
        total: subTasks.length,
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
