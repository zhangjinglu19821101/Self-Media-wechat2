#!/usr/bin/env node

/**
 * 专用查询脚本：查询 task-A-to-B-1770950151247-ixe 的数据情况
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

const TASK_ID = 'task-A-to-B-1770950151247-ixe';

async function main() {
  try {
    console.log('\n=== 查询任务信息 ===');
    console.log(`任务ID: ${TASK_ID}\n`);

    // 1. 查询 agent_tasks 表
    console.log('1️⃣  agent_tasks 表（主任务表）：');
    console.log('-'.repeat(80));
    const agentTasksResult = await pool.query(
      `SELECT task_id, task_name, executor, from_agent_id, to_agent_id, task_status, task_priority, split_status, created_at
       FROM agent_tasks
       WHERE task_id = $1`,
      [TASK_ID]
    );

    if (agentTasksResult.rows.length === 0) {
      console.log('❌ 未找到记录');
    } else {
      console.log(`✅ 找到 ${agentTasksResult.rows.length} 条记录`);
      console.log(JSON.stringify(agentTasksResult.rows, null, 2));
    }
    console.log();

    // 2. 查询 daily_task 表
    console.log('2️⃣  daily_task 表（拆分的每日任务）：');
    console.log('-'.repeat(80));
    const dailyTaskResult = await pool.query(
      `SELECT id, task_id, related_task_id, task_title, executor, execution_status, is_confirmed, rejection_reason, splitter, created_at
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
        console.log(`  关联任务ID: ${row.related_task_id}`);
        console.log(`  任务标题: ${row.task_title}`);
        console.log(`  执行者: ${row.executor}`);
        console.log(`  状态: ${row.execution_status}`);
        console.log(`  是否确认: ${row.is_confirmed}`);
        if (row.rejection_reason) {
          console.log(`  ⚠️ 拒绝原因: ${row.rejection_reason}`);
        }
        console.log(`  拆分人: ${row.splitter}`);
        console.log(`  创建时间: ${row.created_at}`);
      });
    }
    console.log();

    // 3. 查询 agent_sub_tasks 表
    console.log('3️⃣  agent_sub_tasks 表（子任务表）：');
    console.log('-'.repeat(80));
    const subTasksResult = await pool.query(
      `SELECT ast.id, ast.command_result_id, ast.agent_id, ast.task_title, ast.status, ast.order_index, ast.created_at,
              dt.task_id as daily_task_id, dt.related_task_id, dt.executor as daily_executor
       FROM agent_sub_tasks ast
       INNER JOIN daily_task dt ON ast.command_result_id = dt.id
       WHERE dt.related_task_id = $1
       ORDER BY dt.created_at ASC, ast.order_index ASC`,
      [TASK_ID]
    );

    if (subTasksResult.rows.length === 0) {
      console.log('❌ 未找到记录');
    } else {
      console.log(`✅ 找到 ${subTasksResult.rows.length} 条记录`);

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
        console.log(`\n【每日任务 ${index + 1}】${dailyTaskId}`);
        groupedByDailyTask[dailyTaskId].forEach(subtask => {
          console.log(`  - 子任务 ${subtask.order_index}: ${subtask.task_title}`);
          console.log(`    Agent: ${subtask.agent_id}`);
          console.log(`    状态: ${subtask.status}`);
        });
      });
    }
    console.log();

    // 4. 分析汇总
    console.log('4️⃣  数据分析汇总：');
    console.log('-'.repeat(80));

    // 分析拆分人
    const splitters = [...new Set(dailyTaskResult.rows.map(r => r.splitter))];
    console.log(`拆分人: ${splitters.join(', ') || '无'}`);

    // 分析执行者
    const executors = [...new Set(dailyTaskResult.rows.map(r => r.executor))];
    console.log(`执行者: ${executors.join(', ') || '无'}`);

    // 分析子任务 Agent
    const subTaskAgents = [...new Set(subTasksResult.rows.map(r => r.agent_id))];
    console.log(`子任务涉及的Agent: ${subTaskAgents.join(', ') || '无'}`);

    // 检查拒绝记录
    const rejectedTasks = dailyTaskResult.rows.filter(r => r.rejection_reason);
    if (rejectedTasks.length > 0) {
      console.log(`\n⚠️  发现 ${rejectedTasks.length} 条拒绝记录：`);
      rejectedTasks.forEach(task => {
        console.log(`  - 任务: ${task.task_id}`);
        console.log(`    拒绝原因: ${task.rejection_reason}`);
      });
    } else {
      console.log(`\n✅ 未发现拒绝记录`);
    }

    // 检查是否都是 insurance-d 拆分的
    const isAllInsuranceD = splitters.every(s => s.toLowerCase().includes('insurance-d') || s.toLowerCase().includes('d'));
    console.log(`\n是否都是 insurance-d 拆分的: ${isAllInsuranceD ? '✅ 是' : '❌ 否'}`);

    // 检查子任务是否都是 insurance-d
    const isAllSubTasksInsuranceD = subTaskAgents.every(a => a.toLowerCase().includes('insurance-d') || a.toLowerCase().includes('d'));
    console.log(`子任务是否都是 insurance-d: ${isAllSubTasksInsuranceD ? '✅ 是' : '❌ 否'}`);

    console.log('\n=== 查询完成 ===\n');

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
