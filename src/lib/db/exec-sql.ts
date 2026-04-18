/**
 * SQL 执行辅助函数
 * 用于直接执行 SQL 语句，绕过 Drizzle ORM 的某些限制
 */

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

export async function exec_sql(sql: string, params: any[] = []): Promise<any[]> {
  const client = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 10,
    idle_timeout: 20,
    connect_timeout: 60,
  });

  try {
    const result = await client.unsafe(sql, params);
    return result as any[];
  } catch (error) {
    console.error('SQL execution error:', error);
    throw error;
  } finally {
    await client.end();
  }
}
