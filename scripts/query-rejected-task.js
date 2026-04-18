#!/usr/bin/env node

/**
 * 查询任务 task-A-to-B-1770953513980-rph 被拒绝后的状态
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
    console.log('\n=== 任务拒绝状态查询 ===');
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
      console.log(JSON.stringify(task, null, 2));
    }
    console.log();

    // 2. 查询 daily_task 表（包括拒绝记录）
    console.log('2️⃣  daily_task 表（每日任务）：');
    console.log('-'.repeat(80));
    const dailyTaskResult = await pool.query(
      `SELECT id, task_id, related_task_id, task_title, task_description, executor, execution_status, is_confirmed, rejection_reason, splitter, created_at, updated_at
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
        if (row.rejection_reason) {
          console.log(`  ⚠️ 拒绝原因: ${row.rejection_reason}`);
        }
        console.log(`  拆分人: ${row.splitter}`);
        console.log(`  创建时间: ${row.created_at}`);
        console.log(`  更新时间: ${row.updated_at}`);
        console.log();
      });
    }

    // 3. 查询 agent_sub_tasks 表
    console.log('3️⃣  agent_sub_tasks 表（子任务）：');
    console.log('-'.repeat(80));
    const subTasksResult = await pool.query(
      `SELECT ast.id, ast.agent_id, ast.task_title, ast.status, ast.order_index, ast.created_at,
              dt.task_id as daily_task_id, dt.related_task_id
       FROM agent_sub_tasks ast
       INNER JOIN daily_task dt ON ast.command_result_id = dt.id
       WHERE dt.related_task_id = $1
       ORDER BY dt.created_at ASC, ast.order_index ASC`,
      [TASK_ID]
    );

    if (subTasksResult.rows.length === 0) {
      console.log('❌ 未找到记录');
    } else {
      console.log(`✅ 找到 ${subTasksResult.rows.length} 条记录\n`);

      // 按每日任务分组
      const groupedByDailyTask = {};
      subTasksResult.rows.forEach(row => {
        const dailyTaskId = row.daily_task_id;
        if (!groupedByDailyTask[dailyTaskId]) {
          groupedByDailyTask[dailyTaskId] = [];
        }
        groupedByDailyTask[dailyTaskId].push(row);
      });

      Object.keys(groupedByDailyTask).forEach((dailyTaskId, index) => {
        console.log(`【每日任务 ${index + 1}】${dailyTaskId}`);
        groupedByDailyTask[dailyTaskId].forEach(subtask => {
          console.log(`  - 子任务 ${subtask.order_index}: ${subtask.task_title}`);
          console.log(`    Agent: ${subtask.agent_id}`);
          console.log(`    状态: ${subtask.status}`);
        });
        console.log();
      });
    }

    // 4. 汇总分析
    console.log('4️⃣  拒绝流程状态分析：');
    console.log('-'.repeat(80));

    if (dailyTaskResult.rows.length > 0) {
      const confirmedTasks = dailyTaskResult.rows.filter(r => r.is_confirmed);
      const rejectedTasks = dailyTaskResult.rows.filter(r => r.rejection_reason);

      console.log(`总记录数: ${dailyTaskResult.rows.length}`);
      console.log(`已确认: ${confirmedTasks.length}`);
      console.log(`已拒绝: ${rejectedTasks.length}`);

      if (rejectedTasks.length > 0) {
        console.log(`\n⚠️  拒绝记录详情：`);
        rejectedTasks.forEach(task => {
          console.log(`  - 任务: ${task.task_id}`);
          console.log(`    拒绝原因: ${task.rejection_reason}`);
          console.log(`    更新时间: ${task.updated_at}`);
        });
      } else {
        console.log(`\n✅ 无拒绝记录`);
      }
    } else {
      console.log(`❌ 无 daily_task 记录`);
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
