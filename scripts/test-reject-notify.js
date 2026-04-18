#!/usr/bin/env node

/**
 * 测试：检查拒绝后重新拆解的通知
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
    console.log('\n=== 测试：检查拒绝后重新拆解的通知 ===\n');

    // 查询最近的通知（5分钟内）
    const result = await pool.query(
      `SELECT notification_id, from_agent_id, to_agent_id, notification_type, status, priority, created_at
       FROM agent_notifications
       WHERE to_agent_id = 'A'
         AND from_agent_id = 'B'
         AND notification_type = 'task_result'
         AND created_at >= NOW() - INTERVAL '5 minutes'
       ORDER BY created_at DESC
       LIMIT 5`
    );

    if (result.rows.length === 0) {
      console.log('❌ 未找到最近 5 分钟内的拆解结果通知');
    } else {
      console.log(`✅ 找到 ${result.rows.length} 条最近的通知：\n`);

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

    // 查询最近的指令（5分钟内）
    const commandResult = await pool.query(
      `SELECT id, from_agent_id, to_agent_id, command_type, status, created_at
       FROM agent_commands
       WHERE to_agent_id = 'B'
         AND from_agent_id = 'A'
         AND created_at >= NOW() - INTERVAL '5 minutes'
       ORDER BY created_at DESC
       LIMIT 5`
    );

    console.log('\n=== 查询最近的指令 ===\n');

    if (commandResult.rows.length === 0) {
      console.log('❌ 未找到最近 5 分钟内的指令');
    } else {
      console.log(`✅ 找到 ${commandResult.rows.length} 条最近的指令：\n`);

      commandResult.rows.forEach((cmd, index) => {
        console.log(`【指令 ${index + 1}】`);
        console.log(`  指令ID: ${cmd.id}`);
        console.log(`  发送方: ${cmd.from_agent_id}`);
        console.log(`  接收方: ${cmd.to_agent_id}`);
        console.log(`  类型: ${cmd.command_type}`);
        console.log(`  状态: ${cmd.status}`);
        console.log(`  创建时间: ${cmd.created_at}`);
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
