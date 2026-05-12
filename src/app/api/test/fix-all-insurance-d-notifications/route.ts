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
    console.log('🔧 [修复所有 insurance-d 通知] 开始...');

    // 1. 获取所有 insurance-d 通知
    const notifications = await sql`
      SELECT * FROM agent_notifications 
      WHERE notification_type = 'insurance_d_split_result'
      ORDER BY created_at DESC
    `;

    console.log(`📄 找到 ${notifications.length} 条 insurance-d 通知`);

    const results = [];

    for (const notif of notifications) {
      console.log(`\n🔧 处理通知: ${notif.notification_id}`);

      // 2. 解析 content
      let content;
      try {
        content = typeof notif.content === 'string' ? JSON.parse(notif.content) : notif.content;
      } catch (e) {
        console.error('❌ 解析 content 失败:', e);
        continue;
      }

      console.log(`   - 当前 content keys:`, Object.keys(content));

      // 3. 提取 result 并解析
      let splitResult;
      if (content.result) {
        if (typeof content.result === 'string') {
          try {
            splitResult = JSON.parse(content.result);
            console.log(`   - 从 result 字符串解析成功`);
          } catch (e) {
            console.log(`   - result 不是 JSON，直接使用`);
            splitResult = content.result;
          }
        } else {
          splitResult = content.result;
          console.log(`   - result 已经是对象`);
        }
      }

      // 4. 创建新的 content
      const newContent = {
        ...content,
        splitResult: splitResult, // 🔥 关键：添加 splitResult
      };

      console.log(`   - 新 content keys:`, Object.keys(newContent));
      console.log(`   - has splitResult:`, !!newContent.splitResult);

      // 5. 更新通知
      await sql`
        UPDATE agent_notifications 
        SET 
          content = ${JSON.stringify(newContent)},
          is_read = false,
          status = 'unread',
          metadata = jsonb_set(
            COALESCE(metadata::jsonb, '{}'::jsonb),
            '{splitPopupStatus}',
            'null'::jsonb
          )
        WHERE notification_id = ${notif.notification_id}
      `;

      results.push({
        notificationId: notif.notification_id,
        success: true,
        hasSplitResult: !!newContent.splitResult,
      });

      console.log(`   ✅ 通知已修复`);
    }

    return NextResponse.json({
      success: true,
      message: `已修复 ${results.length} 条 insurance-d 通知`,
      results: results,
    });
  } catch (error) {
    console.error('❌ [修复所有 insurance-d 通知] 错误:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
