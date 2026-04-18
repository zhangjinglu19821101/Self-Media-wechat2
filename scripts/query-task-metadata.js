#!/usr/bin/env node

/**
 * 查询任务的详细信息和拒绝历史
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

const TASK_ID = 'task-A-to-B-1770953513980-rph';

async function main() {
  try {
    console.log('\n=== 任务详细信息和拒绝历史 ===');
    console.log(`任务ID: ${TASK_ID}\n`);

    // 查询完整任务信息
    const result = await pool.query(
      `SELECT * FROM agent_tasks WHERE task_id = $1`,
      [TASK_ID]
    );

    if (result.rows.length === 0) {
      console.log('❌ 未找到任务记录');
      return;
    }

    const task = result.rows[0];

    console.log('📋 完整任务信息：');
    console.log('-'.repeat(80));
    console.log(`任务ID: ${task.task_id}`);
    console.log(`任务名称: ${task.task_name.substring(0, 100)}...`);
    console.log(`核心指令: ${task.core_command.substring(0, 200)}...`);
    console.log(`发起方: ${task.from_agent_id}`);
    console.log(`接收方: ${task.to_agent_id}`);
    console.log(`执行者: ${task.executor}`);
    console.log(`任务状态: ${task.task_status}`);
    console.log(`拆分状态: ${task.split_status}`);
    console.log(`创建时间: ${task.created_at}`);
    console.log(`更新时间: ${task.updated_at}`);
    console.log();

    // 检查 metadata 中的拒绝历史
    if (task.metadata) {
      console.log('📊 Metadata 信息：');
      console.log('-'.repeat(80));
      console.log(JSON.stringify(task.metadata, null, 2));
      console.log();

      // 检查是否有 rejectionHistory
      if (task.metadata.rejectionHistory && task.metadata.rejectionHistory.length > 0) {
        console.log('⚠️  拒绝历史记录：');
        task.metadata.rejectionHistory.forEach((history, index) => {
          console.log(`\n【拒绝记录 ${index + 1}】`);
          console.log(`  时间: ${history.timestamp}`);
          console.log(`  拒绝者: ${history.rejectedBy}`);
          console.log(`  原因: ${history.reason}`);
          console.log(`  删除的 daily_task 数量: ${history.deletedDailyTasksCount}`);
        });
      } else {
        console.log('✅ 无拒绝历史记录');
      }
      console.log();
    }

    // 查询是否有旧的 daily_task 记录（被删除前的）
    console.log('🔍 查询可能的旧记录（即使被删除也可能有痕迹）：');
    console.log('-'.repeat(80));

    // 尝试查询包含此任务ID的任何记录
    const searchResult = await pool.query(
      `SELECT id, task_id, related_task_id, task_title, executor, execution_status, is_confirmed, rejection_reason, created_at, updated_at
       FROM daily_task
       WHERE related_task_id = $1
          OR task_id LIKE $2
       ORDER BY created_at DESC
       LIMIT 20`,
      [TASK_ID, `%${TASK_ID}%`]
    );

    if (searchResult.rows.length === 0) {
      console.log('❌ 未找到任何相关记录');
    } else {
      console.log(`✅ 找到 ${searchResult.rows.length} 条相关记录\n`);
      searchResult.rows.forEach((row, index) => {
        console.log(`【记录 ${index + 1}】`);
        console.log(`  任务ID: ${row.task_id}`);
        console.log(`  关联任务: ${row.related_task_id}`);
        console.log(`  任务标题: ${row.task_title}`);
        console.log(`  执行者: ${row.executor}`);
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
