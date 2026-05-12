#!/usr/bin/env node

/**
 * 查询通知详情
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
    console.log('\n=== 查询通知详情 ===\n');

    // 查询通知详情
    const result = await pool.query(
      `SELECT notification_id, from_agent_id, to_agent_id, notification_type, status, priority, content, related_task_id, created_at
       FROM agent_notifications
       WHERE notification_id = 'notif-A-B-split-1770962175243'`
    );

    if (result.rows.length === 0) {
      console.log('❌ 未找到通知');
    } else {
      const notif = result.rows[0];
      console.log('通知详情：');
      console.log(`  通知ID: ${notif.notification_id}`);
      console.log(`  发送方: ${notif.from_agent_id}`);
      console.log(`  接收方: ${notif.to_agent_id}`);
      console.log(`  类型: ${notif.notification_type}`);
      console.log(`  状态: ${notif.status}`);
      console.log(`  优先级: ${notif.priority}`);
      console.log(`  关联任务ID: ${notif.related_task_id}`);
      console.log(`  创建时间: ${notif.created_at}`);
      console.log('\n内容（前500字符）：');
      console.log(notif.content.substring(0, 500));
      console.log();
    }

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
