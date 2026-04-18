#!/usr/bin/env node
/**
 * 查询 agent_sub_tasks 表中 order_index=1 的记录
 */

import { exec_sql } from './src/lib/db/exec-sql';

async function checkAgentSubTaskOrder1() {
  console.log('🔍 查询 agent_sub_tasks 表中 order_index=1 的记录...\n');

  try {
    // 查询 order_index=1 的记录
    const subtasks = await exec_sql('SELECT * FROM agent_sub_tasks WHERE order_index = $1', [1]);

    if (subtasks.length === 0) {
      console.log('❌ 未找到 order_index=1 的记录\n');
      return;
    }

    console.log(`✅ 找到 ${subtasks.length} 条 order_index=1 的记录\n`);

    subtasks.forEach((subtask, index) => {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📋 记录 #${index + 1}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log('ID:', subtask.id);
      console.log('commandResultId:', subtask.command_result_id);
      console.log('fromParentsExecutor:', subtask.from_parents_executor);
      console.log('taskTitle:', subtask.task_title);
      console.log('taskDescription:', subtask.task_description);
      console.log('status:', subtask.status);
      console.log('orderIndex:', subtask.order_index);
      console.log('startedAt:', subtask.started_at);
      console.log('completedAt:', subtask.completed_at);
      console.log('dialogueSessionId:', subtask.dialogue_session_id);
      console.log('dialogueRounds:', subtask.dialogue_rounds);
      console.log('dialogueStatus:', subtask.dialogue_status);
      console.log('lastDialogueAt:', subtask.last_dialogue_at);
      console.log('executionResult:', subtask.execution_result);
      console.log('statusProof:', subtask.status_proof);
      console.log('isDispatched:', subtask.is_dispatched);
      console.log('dispatchedAt:', subtask.dispatched_at);
      console.log('timeoutHandlingCount:', subtask.timeout_handling_count);
      console.log('escalated:', subtask.escalated);
      console.log('escalatedAt:', subtask.escalated_at);
      console.log('escalatedReason:', subtask.escalated_reason);
      console.log('metadata:', JSON.stringify(subtask.metadata, null, 2));
      console.log('feedbackHistory:', JSON.stringify(subtask.feedback_history, null, 2));
      console.log('createdAt:', subtask.created_at);
      console.log('updatedAt:', subtask.updated_at);
      console.log('');

      // 如果 status 是 need_support，特别分析原因
      if (subtask.status === 'need_support') {
        console.log('⚠️  status = need_support，分析原因：');
        console.log('  - dialogueStatus:', subtask.dialogue_status);
        console.log('  - escalated:', subtask.escalated);
        console.log('  - escalatedReason:', subtask.escalated_reason);
        console.log('  - timeoutHandlingCount:', subtask.timeout_handling_count);
        console.log('  - feedbackHistory 数量:', Array.isArray(subtask.feedback_history) ? subtask.feedback_history.length : 0);
        console.log('');
      }
    });

    // 统计不同的 status 值
    const statusCounts: Record<string, number> = {};
    subtasks.forEach(subtask => {
      statusCounts[subtask.status] = (statusCounts[subtask.status] || 0) + 1;
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 status 统计：');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} 条`);
    });

  } catch (error) {
    console.error('❌ 查询失败:', error);
  }
}

checkAgentSubTaskOrder1().then(() => {
  console.log('\n✅ 查询完成！');
  process.exit(0);
}).catch((error) => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
