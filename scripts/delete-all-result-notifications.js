#!/usr/bin/env node

/**
 * 删除所有 result 类型的通知
 */

const { Pool } = require('pg');

// 数据库配置
const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

// 创建数据库连接池
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    console.log('\n=== 删除所有 result 类型的通知 ===\n');

    // 删除所有 result 类型的通知
    const result = await pool.query(
      `DELETE FROM agent_notifications
       WHERE notification_type = 'result'
         AND from_agent_id = 'B'
         AND to_agent_id = 'A'`
    );

    console.log(`✅ 删除了 ${result.rowCount} 条通知`);

  } catch (error) {
    console.error('❌ 操作失败:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
