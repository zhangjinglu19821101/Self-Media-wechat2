#!/usr/bin/env node

/**
 * 检查模糊搜索到的 agent_sub_tasks 记录对应的 related_task_id
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

const TASK_ID = 'task-A-to-B-1770950151247-ixe';

async function main() {
  try {
    console.log('\n=== 检查模糊搜索结果 ===\n');

    // 查询所有包含 task-A-to-B-1770950151247-ixe 的 agent_sub_tasks
    const result = await pool.query(
      `SELECT
        ast.id,
        ast.command_result_id,
        ast.agent_id,
        ast.task_title,
        ast.status,
        dt.task_id as daily_task_id,
        dt.related_task_id,
        dt.executor as daily_executor
       FROM agent_sub_tasks ast
       INNER JOIN daily_task dt ON ast.command_result_id = dt.id
       WHERE ast.command_result_id::text LIKE $1
       ORDER BY ast.created_at DESC`,
      [`%${TASK_ID}%`]
    );

    if (result.rows.length === 0) {
      console.log('❌ 未找到包含该任务ID的记录');
    } else {
      console.log(`✅ 找到 ${result.rows.length} 条包含任务ID "${TASK_ID}" 的记录：\n`);

      // 统计 related_task_id
      const relatedTaskIds = {};
      result.rows.forEach(row => {
        const relatedId = row.related_task_id;
        if (!relatedTaskIds[relatedId]) {
          relatedTaskIds[relatedId] = 0;
        }
        relatedTaskIds[relatedId]++;
      });

      console.log('关联的 related_task_id 统计：');
      Object.keys(relatedTaskIds).forEach(relatedId => {
        console.log(`  - ${relatedId}: ${relatedTaskIds[relatedId]} 条`);
      });

      console.log('\n详细记录：');
      result.rows.forEach((row, index) => {
        console.log(`\n【记录 ${index + 1}】`);
        console.log(`  子任务ID: ${row.id}`);
        console.log(`  Command Result ID: ${row.command_result_id}`);
        console.log(`  Agent: ${row.agent_id}`);
        console.log(`  任务标题: ${row.task_title}`);
        console.log(`  状态: ${row.status}`);
        console.log(`  Daily Task ID: ${row.daily_task_id}`);
        console.log(`  Related Task ID: ${row.related_task_id}`);
        console.log(`  Daily Executor: ${row.daily_executor}`);
      });
    }

    console.log('\n=== 检查完成 ===\n');

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
