#!/usr/bin/env node

/**
 * 查询任务同意后数据保存位置
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
    console.log('\n=== 任务同意后数据保存位置查询 ===');
    console.log(`任务ID: ${TASK_ID}\n`);

    // 1. 查询 agent_tasks 表
    console.log('1️⃣  agent_tasks 表（主任务）：');
    console.log('-'.repeat(80));
    const agentTasksResult = await pool.query(
      `SELECT task_id, task_name, executor, from_agent_id, to_agent_id, task_status, split_status, created_at, updated_at
       FROM agent_tasks
       WHERE task_id = $1`,
      [TASK_ID]
    );

    if (agentTasksResult.rows.length === 0) {
      console.log('❌ 未找到记录');
    } else {
      console.log(`✅ 找到 ${agentTasksResult.rows.length} 条记录`);
      const task = agentTasksResult.rows[0];
      console.log(`  任务状态: ${task.task_status}`);
      console.log(`  拆分状态: ${task.split_status}`);
      console.log(`  创建时间: ${task.created_at}`);
      console.log(`  更新时间: ${task.updated_at}`);
    }
    console.log();

    // 2. 查询 daily_task 表
    console.log('2️⃣  daily_task 表（每日任务）：');
    console.log('-'.repeat(80));
    const dailyTaskResult = await pool.query(
      `SELECT id, task_id, related_task_id, task_title, executor, execution_status, is_confirmed, splitter, created_at, updated_at
       FROM daily_task
       WHERE related_task_id = $1
       ORDER BY created_at ASC`,
      [TASK_ID]
    );

    if (dailyTaskResult.rows.length === 0) {
      console.log('❌ 未找到记录');
    } else {
      console.log(`✅ 找到 ${dailyTaskResult.rows.length} 条记录\n`);
      dailyTaskResult.rows.forEach((row, index) => {
        console.log(`【记录 ${index + 1}】`);
        console.log(`  任务ID: ${row.task_id}`);
        console.log(`  任务标题: ${row.task_title}`);
        console.log(`  执行者: ${row.executor}`);
        console.log(`  状态: ${row.execution_status}`);
        console.log(`  是否确认: ${row.is_confirmed}`);
        console.log(`  拆分人: ${row.splitter}`);
        console.log(`  创建时间: ${row.created_at}`);
      });
    }
    console.log();

    // 3. 查询 agent_sub_tasks 表
    console.log('3️⃣  agent_sub_tasks 表（子任务）：');
    console.log('-'.repeat(80));
    const subTasksResult = await pool.query(
      `SELECT ast.id, ast.agent_id, ast.task_title, ast.status, ast.order_index, ast.created_at,
              dt.task_id as daily_task_id
       FROM agent_sub_tasks ast
       INNER JOIN daily_task dt ON ast.command_result_id = dt.id
       WHERE dt.related_task_id = $1
       ORDER BY ast.order_index ASC`,
      [TASK_ID]
    );

    if (subTasksResult.rows.length === 0) {
      console.log('❌ 未找到记录');
    } else {
      console.log(`✅ 找到 ${subTasksResult.rows.length} 条记录\n`);
      subTasksResult.rows.forEach((row, index) => {
        console.log(`【子任务 ${index + 1}】`);
        console.log(`  Agent: ${row.agent_id}`);
        console.log(`  任务标题: ${row.task_title}`);
        console.log(`  状态: ${row.status}`);
      });
    }
    console.log();

    // 4. 总结
    console.log('4️⃣  数据保存位置总结：');
    console.log('-'.repeat(80));

    if (agentTasksResult.rows.length > 0) {
      const task = agentTasksResult.rows[0];
      console.log(`✅ agent_tasks 表: 有记录`);
      console.log(`   - 任务状态: ${task.task_status}`);
      console.log(`   - 拆分状态: ${task.split_status}`);
    }

    if (dailyTaskResult.rows.length > 0) {
      console.log(`\n✅ daily_task 表: 有 ${dailyTaskResult.rows.length} 条记录`);
      console.log(`   - 这是用户同意拆解后保存的表`);
      console.log(`   - 包含按天拆分的任务`);
    } else {
      console.log(`\n❌ daily_task 表: 无记录`);
    }

    if (subTasksResult.rows.length > 0) {
      console.log(`\n✅ agent_sub_tasks 表: 有 ${subTasksResult.rows.length} 条记录`);
      console.log(`   - 这是 insurance-d 进一步拆分的子任务`);
    } else {
      console.log(`\n❌ agent_sub_tasks 表: 无记录`);
    }

    console.log('\n5️⃣  结论：');
    console.log('-'.repeat(80));
    if (dailyTaskResult.rows.length > 0) {
      console.log('✅ 用户同意拆解后，数据保存到 **daily_task** 表');
      console.log('   - 这是第一层拆解的结果');
      console.log('   - 按天拆分的任务保存在这里');
      console.log('   - insurance-d 可以进一步将这些任务拆解到 agent_sub_tasks 表');
    } else {
      console.log('❌ 未找到拆解后的数据');
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
