#!/usr/bin/env tsx

import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

async function checkDataStructure() {
  console.log('🔍 检查实际数据结构...\n');

  // 1. 查找最近完成的子任务
  console.log('1. 查找最近完成的子任务...');
  const recentTasks = await db.execute(sql`
    SELECT id, command_result_id, status, task_title, execution_result
    FROM agent_sub_tasks
    WHERE status IN ('completed', 'failed')
    ORDER BY updated_at DESC
    LIMIT 3
  `);

  console.log(`   找到 ${recentTasks.rows.length} 个最近完成的任务`);

  for (const task of recentTasks.rows) {
    console.log(`\n   --- 任务 ${task.id} ---`);
    console.log(`   标题: ${task.task_title}`);
    console.log(`   状态: ${task.status}`);
    console.log(`   command_result_id: ${task.command_result_id}`);

    // 2. 查看该任务的 step_history
    if (task.command_result_id) {
      console.log(`\n   2. 查看 step_history 记录...`);
      const stepHistory = await db.execute(sql`
        SELECT step_no, interact_type, interact_num, interact_user, interact_content
        FROM agent_sub_tasks_step_history
        WHERE encode(command_result_id::bytea, 'hex') = encode(${task.command_result_id}::bytea, 'hex')
        ORDER BY step_no, interact_num
      `);

      console.log(`      记录数: ${stepHistory.rows.length}`);

      for (const record of stepHistory.rows) {
        console.log(`\n      Step ${record.step_no}, Num ${record.interact_num}, ${record.interact_type} (${record.interact_user})`);
        console.log(`      Content keys: ${Object.keys(record.interact_content || {}).join(', ')}`);

        // 检查关键数据结构
        const content = record.interact_content;
        if (content?.response) {
          console.log(`      ✓ 有 response`);
          if (content.response.mcp_attempts) {
            console.log(`      ✓ 有 mcp_attempts: ${content.response.mcp_attempts?.length || 0} 次`);
          }
          if (content.response.decision) {
            console.log(`      ✓ 有 decision: ${content.response.decision?.type}`);
          }
        }
        if (content?.execution_result) {
          console.log(`      ✓ 有 execution_result`);
        }
      }

      // 3. 查看 execution_result
      if (task.execution_result) {
        console.log(`\n   3. 查看 execution_result...`);
        try {
          const execResult = typeof task.execution_result === 'string'
            ? JSON.parse(task.execution_result)
            : task.execution_result;
          console.log(`      Keys: ${Object.keys(execResult || {}).join(', ')}`);
          if (execResult?.mcpAttempts) {
            console.log(`      ✓ mcpAttempts: ${execResult.mcpAttempts?.length || 0} 次`);
          }
          if (execResult?.userInteractions) {
            console.log(`      ✓ userInteractions: ${execResult.userInteractions?.length || 0} 次`);
          }
          if (execResult?.decisions) {
            console.log(`      ✓ decisions: ${execResult.decisions?.length || 0} 个`);
          }
        } catch (e) {
          console.log(`      解析失败: ${e}`);
        }
      }
    }
  }

  console.log('\n✅ 数据结构检查完成!');
}

checkDataStructure().catch(console.error);
