#!/usr/bin/env node
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function main() {
  const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
  try {
    console.log('🔍 检查最新的通知...\n');
    
    const notifications = await sql`
      SELECT id, notification_id, title, created_at, metadata::text, content::text
      FROM agent_notifications
      ORDER BY created_at DESC
      LIMIT 3;
    `;
    
    console.log(`✅ 查询到 ${notifications.length} 条通知\n`);
    
    notifications.forEach((n, i) => {
      console.log(`=== 通知 ${i+1} ===`);
      console.log(`  ID: ${n.id}`);
      console.log(`  Notification ID: ${n.notification_id}`);
      console.log(`  Title: ${n.title}`);
      console.log(`  Created: ${n.created_at}`);
      
      if (n.metadata) {
        try {
          const metadata = JSON.parse(n.metadata);
          console.log(`  Metadata keys: ${Object.keys(metadata).join(', ')}`);
          if (metadata.pendingSubTasksByTask) {
            console.log(`  ✅ 有 pendingSubTasksByTask: ${Object.keys(metadata.pendingSubTasksByTask).length} 个任务`);
          }
        } catch (e) {
          console.log(`  Metadata: (parse error)`);
        }
      }
      console.log('');
    });

  } catch (e) { console.error('❌ 错误:', e); }
  finally { await sql.end(); }
}
main();
