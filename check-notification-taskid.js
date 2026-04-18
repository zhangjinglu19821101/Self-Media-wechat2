#!/usr/bin/env node
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function main() {
  const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
  try {
    console.log('🔍 查看最新 insurance-d 通知的完整数据...\n');
    
    const notifications = await sql`
      SELECT *
      FROM agent_notifications
      WHERE notification_type = 'insurance_d_split_result'
      ORDER BY created_at DESC
      LIMIT 2;
    `;

    if (notifications.length === 0) {
      console.log('❌ 没有找到 insurance-d 通知');
      return;
    }

    notifications.forEach((n, i) => {
      console.log(`\n📋 通知 ${i + 1}:`);
      console.log('  id:', n.id);
      console.log('  notification_id:', n.notification_id);
      console.log('  notification_type:', n.notification_type);
      console.log('  related_task_id:', n.related_task_id);
      
      if (n.metadata) {
        try {
          const meta = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata;
          console.log('  metadata 键:', Object.keys(meta));
          console.log('  metadata.dailyTaskIds:', meta.dailyTaskIds);
          console.log('  metadata.taskId:', meta.taskId);
        } catch (e) {
          console.log('  metadata:', n.metadata);
        }
      }
    });

  } catch (e) { console.error('❌ 错误:', e); }
  finally { await sql.end(); }
}
main();
