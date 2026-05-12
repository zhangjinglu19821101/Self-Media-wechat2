import { NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

const sql = postgres(DATABASE_URL, {
  ssl: 'require',
  max: 10,
  idle_timeout: 20,
  connect_timeout: 60,
});

export async function POST(request: Request) {
  try {
    console.log('🔧 [修复通知格式] 开始...');

    // 1. 获取当前通知
    const currentNotif = await sql`
      SELECT * FROM agent_notifications 
      WHERE notification_id = 'notification-310d3cba-b5e1-46d0-bbef-6a1828cb639f'
    `;

    if (currentNotif.length === 0) {
      return NextResponse.json(
        { success: false, error: '通知不存在' },
        { status: 404 }
      );
    }

    const notif = currentNotif[0];
    console.log(`📄 当前通知:`, notif.notification_id);

    // 2. 解析 content
    let content;
    try {
      content = typeof notif.content === 'string' ? JSON.parse(notif.content) : notif.content;
    } catch (e) {
      console.error('❌ 解析 content 失败:', e);
      return NextResponse.json(
        { success: false, error: '解析 content 失败' },
        { status: 500 }
      );
    }

    console.log(`🔍 Content keys:`, Object.keys(content));

    // 3. 创建新的 content，同时包含 result 和 splitResult
    const result = content.result;
    let splitResult;
    
    if (typeof result === 'string') {
      try {
        splitResult = JSON.parse(result);
      } catch (e) {
        console.log('⚠️ result 不是 JSON，直接使用:', result);
        splitResult = result;
      }
    } else {
      splitResult = result;
    }

    const newContent = {
      ...content,
      splitResult: splitResult, // 🔥 关键：添加 splitResult 字段
    };

    console.log(`✅ 新 content 包含 splitResult:`, !!newContent.splitResult);

    // 4. 更新通知
    await sql`
      UPDATE agent_notifications 
      SET 
        content = ${JSON.stringify(newContent)},
        is_read = false,
        status = 'unread',
        metadata = jsonb_set(
          metadata::jsonb,
          '{splitPopupStatus}',
          'null'::jsonb
        )
      WHERE notification_id = 'notification-310d3cba-b5e1-46d0-bbef-6a1828cb639f'
    `;

    console.log(`✅ 通知格式已修复`);

    return NextResponse.json({
      success: true,
      message: '通知格式已修复',
      notificationId: notif.notification_id,
      contentKeys: Object.keys(newContent),
      hasSplitResult: !!newContent.splitResult,
    });
  } catch (error) {
    console.error('❌ [修复通知格式] 错误:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
