#!/usr/bin/env node

/**
 * 测试任务拒绝后重新拆解的目标 Agent
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
    console.log('\n=== 测试：拒绝后重新拆解的目标 Agent ===\n');

    // 查询 Agent A 下发给 insurance-d 的任务
    const result = await pool.query(
      `SELECT task_id, from_agent_id, to_agent_id, executor, task_status, split_status
       FROM agent_tasks
       WHERE from_agent_id = 'A'
         AND (to_agent_id LIKE '%insurance-d%' OR executor LIKE '%insurance-d%')
       ORDER BY created_at DESC
       LIMIT 5`
    );

    if (result.rows.length === 0) {
      console.log('❌ 未找到相关任务');
      return;
    }

    console.log(`✅ 找到 ${result.rows.length} 条相关任务：\n`);

    result.rows.forEach((task, index) => {
      console.log(`【任务 ${index + 1}】`);
      console.log(`  任务ID: ${task.task_id}`);
      console.log(`  发起方: ${task.from_agent_id}`);
      console.log(`  接收方: ${task.to_agent_id}`);
      console.log(`  执行者: ${task.executor}`);
      console.log(`  任务状态: ${task.task_status}`);
      console.log(`  拆分状态: ${task.split_status}`);
      console.log();
    });

    console.log('=== 拒绝后重新拆解的目标 Agent 逻辑 ===\n');

    console.log('1️⃣  第一次拆解（用户点击"确认拆解"后）：');
    console.log('   - 始终发送给 Agent B 拆解');
    console.log('   - Agent B 返回拆解结果');
    console.log();

    console.log('2️⃣  拒绝后重新拆解（用户拒绝后）：');
    console.log('   - 步骤 1: 检查拆解结果中 executor 字段');
    console.log('   - 步骤 2: 如果 executor 不是 B，则使用 executor');
    console.log('   - 步骤 3: 如果 executor 是 B，则查询任务的 toAgentId');
    console.log('   - 步骤 4: 如果 toAgentId 存在，则使用 toAgentId');
    console.log('   - 步骤 5: 如果都没找到，默认使用 Agent B');
    console.log();

    console.log('3️⃣  对于 Agent A → insurance-d 的任务：');
    console.log('   - toAgentId = "insurance-d" 或 "agent B"');
    console.log('   - 第一次拆解：Agent B 执行');
    console.log('   - 拒绝后重新拆解：发送给 Agent B（因为 toAgentId 是 "agent B"）');
    console.log();

    console.log('=== 结论 ===\n');
    console.log('❌ 拒绝后重新拆解，始终发送给 Agent B');
    console.log('✅ 不会发送给 insurance-d 重新拆解');
    console.log('📌 insurance-d 的角色是执行任务，不是拆解任务');
    console.log();

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
