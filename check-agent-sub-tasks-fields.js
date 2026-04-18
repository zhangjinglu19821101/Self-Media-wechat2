#!/usr/bin/env node
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function main() {
  const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
  try {
    console.log('🔍 检查 agent_sub_tasks 表的实际字段...\n');
    
    // 先看看有没有数据
    const data = await sql`
      SELECT *
      FROM agent_sub_tasks
      LIMIT 1;
    `;
    
    if (data.length > 0) {
      const t = data[0];
      console.log('✅ agent_sub_tasks 实际字段:');
      console.log('  所有字段:', Object.keys(t));
    } else {
      // 没有数据，查 schema
      console.log('ℹ️ 表中没有数据，查询表结构...');
      const columns = await sql`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'agent_sub_tasks'
        ORDER BY ordinal_position;
      `;
      console.log('✅ agent_sub_tasks 表结构:');
      columns.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
    }

  } catch (e) { console.error('❌ 错误:', e); }
  finally { await sql.end(); }
}
main();
