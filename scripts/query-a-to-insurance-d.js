#!/usr/bin/env node

/**
 * 查询 Agent A 下发给 insurance-d 的任务
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
    console.log('\n=== 查询 Agent A 下发给 insurance-d 的任务 ===\n');

    // 查询 Agent A 下发给 insurance-d 的任务
    const result = await pool.query(
      `SELECT
        task_id,
        task_name,
        from_agent_id,
        to_agent_id,
        executor,
        task_status,
        split_status,
        created_at,
        updated_at
       FROM agent_tasks
       WHERE from_agent_id = 'A'
         AND executor = 'insurance-d'
       ORDER BY created_at DESC
       LIMIT 10`
    );

    if (result.rows.length === 0) {
      console.log('❌ 未找到 Agent A 下发给 insurance-d 的任务');
    } else {
      console.log(`✅ 找到 ${result.rows.length} 条记录：\n`);

      result.rows.forEach((task, index) => {
        console.log(`【任务 ${index + 1}】`);
        console.log(`  任务ID: ${task.task_id}`);
        console.log(`  发起方: ${task.from_agent_id}`);
        console.log(`  接收方: ${task.to_agent_id}`);
        console.log(`  执行者: ${task.executor}`);
        console.log(`  任务状态: ${task.task_status}`);
        console.log(`  拆分状态: ${task.split_status}`);
        console.log(`  创建时间: ${task.created_at}`);
        console.log();
      });
    }

    console.log('=== 查询完成 ===\n');

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
