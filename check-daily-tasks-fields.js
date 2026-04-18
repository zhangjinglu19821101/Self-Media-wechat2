#!/usr/bin/env node
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function main() {
  const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
  try {
    console.log('🔍 检查 daily_task 表的实际字段...\n');
    
    const tasks = await sql`
      SELECT *
      FROM daily_task
      LIMIT 1;
    `;
    
    if (tasks.length > 0) {
      const t = tasks[0];
      console.log('✅ daily_task 实际字段:');
      console.log('  所有字段:', Object.keys(t));
      console.log('  id:', t.id);
      console.log('  task_id:', t.task_id);
      console.log('  execution_status:', t.execution_status);
      console.log('  executor:', t.executor);
      console.log('  sub_task_count:', t.sub_task_count);
      console.log('  split_rejected:', t.split_rejected);
    }

  } catch (e) { console.error('❌ 错误:', e); }
  finally { await sql.end(); }
}
main();
