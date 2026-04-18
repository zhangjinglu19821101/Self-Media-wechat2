#!/usr/bin/env node

/**
 * 查询所有通知
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
    console.log('\n=== 查询所有通知 ===\n');

    // 查询所有通知
    const result = await pool.query(
      `SELECT notification_id, from_agent_id, to_agent_id, notification_type, status, priority, created_at
       FROM agent_notifications
       ORDER BY created_at DESC
       LIMIT 10`
    );

    if (result.rows.length === 0) {
      console.log('❌ 未找到任何通知');
    } else {
      console.log(`✅ 找到 ${result.rows.length} 条通知：\n`);

      result.rows.forEach((notif, index) => {
        console.log(`【通知 ${index + 1}】`);
        console.log(`  通知ID: ${notif.notification_id}`);
        console.log(`  发送方: ${notif.from_agent_id}`);
        console.log(`  接收方: ${notif.to_agent_id}`);
        console.log(`  类型: ${notif.notification_type}`);
        console.log(`  状态: ${notif.status}`);
        console.log(`  优先级: ${notif.priority}`);
        console.log(`  创建时间: ${notif.created_at}`);
        console.log();
      });
    }

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
