#!/usr/bin/env node
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function main() {
  const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
  try {
    console.log('🔍 检查最新通知的字段...\n');
    
    const notifications = await sql`
      SELECT *
      FROM agent_notifications
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    
    if (notifications.length > 0) {
      const n = notifications[0];
      console.log('✅ 最新通知数据:');
      console.log('  所有字段:', Object.keys(n));
      console.log('  id:', n.id);
      console.log('  type:', n.type);
      console.log('  title:', n.title ? '存在' : '不存在');
      console.log('  notification_id:', n.notification_id ? '存在' : '不存在');
      console.log('  metadata:', n.metadata ? '存在' : '不存在');
      console.log('  content:', n.content ? '存在' : '不存在');
      
      if (n.metadata) {
        try {
          const meta = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata;
          console.log('  metadata 键:', Object.keys(meta));
        } catch (e) {}
      }
    }

  } catch (e) { console.error('❌ 错误:', e); }
  finally { await sql.end(); }
}
main();
