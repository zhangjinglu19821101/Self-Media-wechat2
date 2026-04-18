#!/usr/bin/env node

/**
 * 查询所有包含 "insurance-d" 的最新 daily_task 记录
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
    console.log('\n=== 查询 insurance-d 相关的最新记录 ===\n');

    const result = await pool.query(
      `SELECT id, task_id, related_task_id, task_title, executor, execution_status, is_confirmed, rejection_reason, created_at, updated_at
       FROM daily_task
       WHERE executor = 'insurance-d'
       ORDER BY created_at DESC
       LIMIT 20`
    );

    if (result.rows.length === 0) {
      console.log('❌ 未找到记录');
    } else {
      console.log(`✅ 找到 ${result.rows.length} 条记录\n`);

      result.rows.forEach((row, index) => {
        console.log(`【记录 ${index + 1}】`);
        console.log(`  任务ID: ${row.task_id}`);
        console.log(`  关联任务: ${row.related_task_id}`);
        console.log(`  任务标题: ${row.task_title}`);
        console.log(`  状态: ${row.execution_status}`);
        console.log(`  是否确认: ${row.is_confirmed}`);
        if (row.rejection_reason) {
          console.log(`  ⚠️ 拒绝原因: ${row.rejection_reason}`);
        }
        console.log(`  创建时间: ${row.created_at}`);
        console.log(`  更新时间: ${row.updated_at}`);
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
