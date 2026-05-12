import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

/**
 * 查询最新的通知
 * GET /api/debug/notifications?toAgentId=A&limit=5
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const toAgentId = searchParams.get('toAgentId') || 'A';
    const limit = parseInt(searchParams.get('limit') || '10');

    const sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 10,
    });

    const notifications = await sql`
      SELECT notification_id, from_agent_id, to_agent_id, notification_type,
             title, content, related_task_id, metadata,
             status, created_at
      FROM agent_notifications
      WHERE to_agent_id = ${toAgentId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    await sql.end();

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        total: notifications.length,
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
