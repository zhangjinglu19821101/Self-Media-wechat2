/**
 * 查询 agent_notifications 表数据
 * GET /api/test/query-notifications
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

    console.log('🔍 查询 agent_notifications 表数据...');

    // 查询所有通知，按创建时间倒序
    const notifications = await sql`
      SELECT 
        notification_id,
        notification_type,
        from_agent_id,
        to_agent_id,
        related_task_id,
        title,
        content,
        metadata,
        is_read,
        created_at
      FROM agent_notifications
      ORDER BY created_at DESC
      LIMIT 20
    `;

    console.log(`✅ 查询完成，共 ${notifications.length} 条记录`);

    await sql.end();

    return NextResponse.json({
      success: true,
      count: notifications.length,
      notifications: notifications.map(notif => ({
        notificationId: notif.notification_id,
        notificationType: notif.notification_type,
        fromAgentId: notif.from_agent_id,
        toAgentId: notif.to_agent_id,
        relatedTaskId: notif.related_task_id,
        title: notif.title,
        content: notif.content,
        metadata: notif.metadata,
        isRead: notif.is_read,
        createdAt: notif.created_at,
      })),
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
