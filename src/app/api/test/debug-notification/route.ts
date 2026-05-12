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
    console.log('🔍 [调试通知] 开始...');

    // 1. 获取最新的 insurance-d 通知
    const notifications = await sql`
      SELECT * FROM agent_notifications 
      WHERE notification_type = 'insurance_d_split_result'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (notifications.length === 0) {
      return NextResponse.json(
        { success: false, error: '没有找到 insurance-d 通知' },
        { status: 404 }
      );
    }

    const notif = notifications[0];
    console.log(`📄 通知 ID:`, notif.notification_id);

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
    console.log(`🔍 has result:`, !!content.result);
    console.log(`🔍 has splitResult:`, !!content.splitResult);

    // 3. 检查 result 的内容
    if (content.result) {
      console.log(`🔍 result 类型:`, typeof content.result);
      if (typeof content.result === 'string') {
        console.log(`🔍 result 长度:`, content.result.length);
        try {
          const parsedResult = JSON.parse(content.result);
          console.log(`🔍 解析后的 result keys:`, Object.keys(parsedResult));
          console.log(`🔍 has subTasks:`, !!parsedResult.subTasks);
        } catch (e) {
          console.log(`🔍 result 不是 JSON:`, e);
        }
      } else {
        console.log(`🔍 result keys:`, Object.keys(content.result));
      }
    }

    return NextResponse.json({
      success: true,
      notificationId: notif.notification_id,
      contentKeys: Object.keys(content),
      hasResult: !!content.result,
      hasSplitResult: !!content.splitResult,
      isRead: notif.is_read,
      status: notif.status,
    });
  } catch (error) {
    console.error('❌ [调试通知] 错误:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
