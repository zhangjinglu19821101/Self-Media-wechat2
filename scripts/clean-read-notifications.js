#!/usr/bin/env node

/**
 * 清空未读通知（用于测试）
 */

const { Pool } = require('pg');

// 数据库配置
const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

// 创建数据库连接池
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    console.log('\n=== 清空未读通知（用于测试） ===\n');

    // 删除所有未读的通知
    const result = await pool.query(
      `DELETE FROM agent_notifications
       WHERE is_read = true
         AND notification_type = 'result'
         AND from_agent_id = 'B'
         AND to_agent_id = 'A'
         AND created_at < NOW() - INTERVAL '1 hour'`
    );

    console.log(`✅ 删除了 ${result.rowCount} 条已读通知（1小时前创建）`);

    // 查询剩余的通知
    const countResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM agent_notifications
       WHERE notification_type = 'result'
         AND from_agent_id = 'B'
         AND to_agent_id = 'A'`
    );

    console.log(`📊 剩余通知数量: ${countResult.rows[0].count}`);

  } catch (error) {
    console.error('❌ 操作失败:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
