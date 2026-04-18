#!/usr/bin/env node
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function main() {
  const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
  try {
    console.log('🔍 列出数据库中的所有表...\n');
    
    const tables = await sql`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `;
    
    if (tables.length > 0) {
      console.log('✅ 找到的表:');
      tables.forEach((t, i) => console.log(`  ${i+1}. ${t.tablename}`));
    }

  } catch (e) { console.error('❌ 错误:', e); }
  finally { await sql.end(); }
}
main();
