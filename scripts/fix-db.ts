import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { reminders } from './src/lib/db/schema/reminders';
import { sql } from 'drizzle-orm';

const connectionString = "postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require";
const sslOptions = { ssl: { rejectUnauthorized: false } };

async function fixDatabase() {
  const client = postgres(connectionString, sslOptions);
  const db = drizzle(client);

  try {
    console.log('检查 reminders 表结构...');
    
    // 添加 direction 字段
    await client.unsafe(`
      ALTER TABLE reminders ADD COLUMN IF NOT EXISTS direction VARCHAR(20) NOT NULL DEFAULT 'outbound';
    `);
    console.log('✅ direction 字段已添加');
    
    // 添加索引
    await client.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_reminders_direction ON reminders(direction);
    `);
    console.log('✅ direction 索引已添加');
    
    console.log('数据库修复完成！');
  } catch (error) {
    console.error('修复失败:', error);
  } finally {
    await client.end();
  }
}

fixDatabase();
