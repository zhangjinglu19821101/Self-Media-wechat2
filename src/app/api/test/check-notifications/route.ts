/**
 * 检查所有通知
 * GET /api/test/check-notifications
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

    console.log('🔍 [检查] 查询所有通知...');

    // 查询所有通知
    const notifications = await sql`
      SELECT 
        id,
        notification_type,
        to_agent_id,
        title,
        content,
        related_task_id,
        created_at,
        is_read,
        metadata
      FROM agent_notifications
      ORDER BY created_at DESC
      LIMIT 20
    `;

    console.log(`✅ [检查] 找到 ${notifications.length} 个通知`);

    await sql.end();

    return NextResponse.json({
      success: true,
      count: notifications.length,
      notifications: notifications.map(n => ({
        id: n.id,
        type: n.notification_type,
        recipient: n.to_agent_id,
        title: n.title,
        content: n.content,
        relatedTaskId: n.related_task_id,
        createdAt: n.created_at,
        isRead: n.is_read,
        metadata: n.metadata,
      })),
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
