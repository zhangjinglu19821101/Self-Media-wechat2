import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

/**
 * 更新通知状态
 * POST /api/debug/update-notification-status
 * Body: { notificationId: string, newStatus: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationId, newStatus } = body;

    if (!notificationId || !newStatus) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必填字段：notificationId, newStatus',
        },
        { status: 400 }
      );
    }

    const sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 10,
    });

    console.log(`🔧 更新通知状态: ${notificationId} -> ${newStatus}`);

    const result = await sql`
      UPDATE agent_notifications
      SET status = ${newStatus}
      WHERE notification_id = ${notificationId}
      RETURNING *
    `;

    await sql.end();

    if (result.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '通知不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '通知状态更新成功',
      data: result[0],
    });
  } catch (error) {
    console.error('❌ 更新失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
