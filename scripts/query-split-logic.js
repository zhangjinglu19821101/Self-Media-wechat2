#!/usr/bin/env node

/**
 * 查询 task-A-to-insurance-d-1770920687891-g6v 的拆分情况
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

const TASK_ID = 'task-A-to-insurance-d-1770920687891-g6v';

async function main() {
  try {
    console.log('\n=== 任务拆分情况查询 ===');
    console.log(`任务ID: ${TASK_ID}\n`);

    // 1. 查询 agent_tasks 表
    console.log('1️⃣  agent_tasks 表（主任务）：');
    console.log('-'.repeat(80));
    const agentTasksResult = await pool.query(
      `SELECT task_id, task_name, executor, from_agent_id, to_agent_id, task_status, split_status, created_at
       FROM agent_tasks
       WHERE task_id = $1`,
      [TASK_ID]
    );

    if (agentTasksResult.rows.length === 0) {
      console.log('❌ 未找到记录');
    } else {
      console.log(`✅ 找到 ${agentTasksResult.rows.length} 条记录`);
      console.log(JSON.stringify(agentTasksResult.rows[0], null, 2));
    }
    console.log();

    // 2. 查询 daily_task 表
    console.log('2️⃣  daily_task 表（每日任务）：');
    console.log('-'.repeat(80));
    const dailyTaskResult = await pool.query(
      `SELECT id, task_id, related_task_id, task_title, executor, execution_status, splitter, created_at
       FROM daily_task
       WHERE related_task_id = $1
       ORDER BY created_at ASC`,
      [TASK_ID]
    );

    if (dailyTaskResult.rows.length === 0) {
      console.log('❌ 未找到记录');
    } else {
      console.log(`✅ 找到 ${dailyTaskResult.rows.length} 条记录`);
      dailyTaskResult.rows.forEach((row, index) => {
        console.log(`\n【记录 ${index + 1}】`);
        console.log(`  任务ID: ${row.task_id}`);
        console.log(`  任务标题: ${row.task_title}`);
        console.log(`  执行者: ${row.executor}`);
        console.log(`  状态: ${row.execution_status}`);
        console.log(`  拆分人: ${row.splitter}`);
        console.log(`  创建时间: ${row.created_at}`);
      });
    }
    console.log();

    // 3. 查询 agent_sub_tasks 表（如果有的话）
    console.log('3️⃣  agent_sub_tasks 表（子任务）：');
    console.log('-'.repeat(80));
    const subTasksResult = await pool.query(
      `SELECT ast.id, ast.agent_id, ast.task_title, ast.status, ast.order_index, ast.created_at
       FROM agent_sub_tasks ast
       WHERE ast.command_result_id IN (
         SELECT id FROM daily_task WHERE related_task_id = $1
       )
       ORDER BY ast.order_index ASC`,
      [TASK_ID]
    );

    if (subTasksResult.rows.length === 0) {
      console.log('❌ 未找到记录');
    } else {
      console.log(`✅ 找到 ${subTasksResult.rows.length} 条记录`);
      subTasksResult.rows.forEach((row, index) => {
        console.log(`\n【子任务 ${index + 1}】`);
        console.log(`  Agent: ${row.agent_id}`);
        console.log(`  任务标题: ${row.task_title}`);
        console.log(`  状态: ${row.status}`);
        console.log(`  顺序: ${row.order_index}`);
        console.log(`  创建时间: ${row.created_at}`);
      });
    }
    console.log();

    // 4. 分析汇总
    console.log('4️⃣  拆分逻辑分析：');
    console.log('-'.repeat(80));

    if (agentTasksResult.rows.length > 0) {
      const task = agentTasksResult.rows[0];
      console.log(`发起方: ${task.from_agent_id}`);
      console.log(`接收方: ${task.to_agent_id}`);
      console.log(`执行者: ${task.executor}`);
      console.log(`任务状态: ${task.task_status}`);
      console.log(`拆分状态: ${task.split_status}`);
    }

    if (dailyTaskResult.rows.length > 0) {
      console.log(`\n✅ 任务已拆分到 daily_task 表`);
      console.log(`   拆分记录数: ${dailyTaskResult.rows.length}`);
    } else {
      console.log(`\n❌ 任务未拆分到 daily_task 表`);
    }

    if (subTasksResult.rows.length > 0) {
      console.log(`\n✅ 有子任务数据`);
      console.log(`   子任务数: ${subTasksResult.rows.length}`);
    } else {
      console.log(`\n❌ 无子任务数据`);
    }

    console.log('\n=== 查询完成 ===\n');

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
