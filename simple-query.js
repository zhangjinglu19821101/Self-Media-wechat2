#!/usr/bin/env node
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

async function main() {
  const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });
  try {
    const records = await sql`SELECT id, task_id, task_title, executor, execution_status FROM daily_task ORDER BY created_at DESC`;
    console.log('Total records:', records.length);
    records.forEach((r, i) => {
      console.log(i+1 + '. ' + r.id + ' - ' + r.task_title + ' (' + r.executor + ') - ' + r.execution_status);
    });
  } catch (e) { console.error(e); }
  finally { await sql.end(); }
}
main();
