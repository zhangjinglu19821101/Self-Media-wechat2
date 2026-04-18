#!/usr/bin/env node

/**
 * 详细查询 Agent A → insurance-d 任务的 toAgentId
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
    console.log('\n=== 详细查询 toAgentId ===\n');

    const result = await pool.query(
      `SELECT task_id, from_agent_id, to_agent_id, executor, core_command
       FROM agent_tasks
       WHERE task_id = $1`,
      ['task-A-to-insurance-d-1770920687891-g6v']
    );

    if (result.rows.length === 0) {
      console.log('❌ 未找到任务');
      return;
    }

    const task = result.rows[0];

    console.log('任务信息：');
    console.log(`  任务ID: ${task.task_id}`);
    console.log(`  发起方: ${task.from_agent_id}`);
    console.log(`  接收方: ${task.to_agent_id}`);
    console.log(`  执行者: ${task.executor}`);
    console.log(`  核心指令: ${task.core_command.substring(0, 100)}...`);
    console.log();

    console.log('=== 分析 ===\n');
    console.log('1️⃣  如果 toAgentId = "insurance-d"：');
    console.log('   - 拒绝后重新拆解会发送给 insurance-d');
    console.log('   - ⚠️ 这可能不符合设计意图');
    console.log('   - insurance-d 不应该负责任务拆解');
    console.log();

    console.log('2️⃣  如果 toAgentId = "agent B"：');
    console.log('   - 拒绝后重新拆解会发送给 Agent B');
    console.log('   - ✅ 这符合设计意图');
    console.log('   - Agent B 负责所有任务的拆解');
    console.log();

    console.log('3️⃣  当前实际值：');
    console.log(`   toAgentId = "${task.to_agent_id}"`);
    console.log();

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
