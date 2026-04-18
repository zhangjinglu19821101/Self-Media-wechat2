#!/usr/bin/env node

/**
 * 查询任务 task-A-to-B-1770950151247-ixe 的接收方信息
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
    console.log('\n=== 任务接收方确认 ===\n');
    console.log(`任务ID: ${TASK_ID}\n`);

    const result = await pool.query(
      `SELECT
        task_id,
        task_name,
        core_command,
        from_agent_id as from_agent,
        to_agent_id as to_agent,
        executor,
        task_status,
        split_status,
        created_at
       FROM agent_tasks
       WHERE task_id = $1`,
      [TASK_ID]
    );

    if (result.rows.length === 0) {
      console.log('❌ 未找到任务记录');
      return;
    }

    const task = result.rows[0];

    console.log('📋 任务详情：');
    console.log('-'.repeat(80));
    console.log(`任务ID: ${task.task_id}`);
    console.log(`任务名称: ${task.task_name.substring(0, 100)}...`);
    console.log(`指令内容: ${task.core_command.substring(0, 150)}...`);
    console.log();
    console.log('👤 涉及的 Agent：');
    console.log(`  发起方 (from_agent_id): ${task.from_agent}`);
    console.log(`  接收方 (to_agent_id): ${task.to_agent}`);
    console.log(`  执行者 (executor): ${task.executor}`);
    console.log();
    console.log('📊 任务状态：');
    console.log(`  任务状态: ${task.task_status}`);
    console.log(`  拆分状态: ${task.split_status}`);
    console.log();

    // 判断结论
    console.log('✅ 结论：');
    console.log('-'.repeat(80));

    if (task.to_agent.toLowerCase().includes('insurance-d') || task.executor.toLowerCase().includes('insurance-d')) {
      console.log('❌ 指令是下发给 insurance-d 的');
      console.log('   如果收到的是"架构师B 的执行结果"，这是不正确的！');
      console.log('   应该收到的是 insurance-d 的执行结果。');
    } else if (task.to_agent.toLowerCase().includes('b') || task.executor.toLowerCase().includes('b')) {
      console.log('✅ 指令是下发给 Agent B（架构师B）的');
      console.log('   收到"架构师B 的执行结果"是正确的。');
      console.log('   这个任务不需要 insurance-d 执行。');
    } else {
      console.log(`⚠️  指令是下发给 ${task.to_agent} 的`);
      console.log(`   执行者是 ${task.executor}`);
      console.log('   请确认是否符合预期。');
    }

    console.log();

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
