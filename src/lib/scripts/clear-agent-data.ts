/**
 * 清空 Agent 相关表数据
 * 用于重新测试
 */

import { db } from '@/lib/db';
import { agentMemories, agentTasks, agentFeedbacks, agentNotifications, agentSubTasks, agentInteractions, agentReports, agentDevPrinciples, conversations, messages, dailyTask } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

async function clearAgentData() {
  console.log('🧹 开始清空 Agent 相关表数据...');

  try {
    // 清空顺序：从子表到父表，避免外键约束错误

    // 1. 清空对话消息表
    console.log('📦 清空 messages 表...');
    await db.delete(messages);
    console.log('✅ messages 表已清空');

    // 2. 清空对话会话表
    console.log('📦 清空 conversations 表...');
    await db.delete(conversations);
    console.log('✅ conversations 表已清空');

    // 3. 清空 Agent 子任务表
    console.log('📦 清空 agent_sub_tasks 表...');
    await db.delete(agentSubTasks);
    console.log('✅ agent_sub_tasks 表已清空');

    // 4. 清空 Agent 交互表
    console.log('📦 清空 agent_interactions 表...');
    await db.delete(agentInteractions);
    console.log('✅ agent_interactions 表已清空');

    // 5. 清空 Agent 通知表
    console.log('📦 清空 agent_notifications 表...');
    await db.delete(agentNotifications);
    console.log('✅ agent_notifications 表已清空');

    // 6. 清空 Agent 反馈表
    console.log('📦 清空 agent_feedbacks 表...');
    await db.delete(agentFeedbacks);
    console.log('✅ agent_feedbacks 表已清空');

    // 7. 清空 Agent 任务表
    console.log('📦 清空 agent_tasks 表...');
    await db.delete(agentTasks);
    console.log('✅ agent_tasks 表已清空');

    // 8. 清空 Agent 记忆表
    console.log('📦 清空 agent_memories 表...');
    await db.delete(agentMemories);
    console.log('✅ agent_memories 表已清空');

    // 9. 清空 Agent 报告表
    console.log('📦 清空 agent_reports 表...');
    await db.delete(agentReports);
    console.log('✅ agent_reports 表已清空');

    // 10. 清空 Agent 开发原则表
    console.log('📦 清空 agent_dev_principles 表...');
    await db.delete(agentDevPrinciples);
    console.log('✅ agent_dev_principles 表已清空');

    // 11. 重置 daily_task 表中的状态字段（可选：保留任务数据，重置状态）
    console.log('📦 重置 daily_task 表状态...');
    await db.update(dailyTask)
      .set({
        executionStatus: 'pending',
        completedSubTasks: 0,
        completedSubTasksDescription: '',
        subTaskCount: 0,
      });
    console.log('✅ daily_task 表状态已重置');

    console.log('🎉 Agent 相关表数据清空完成！');
  } catch (error) {
    console.error('❌ 清空数据失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  clearAgentData()
    .then(() => {
      console.log('✅ 脚本执行成功');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 脚本执行失败:', error);
      process.exit(1);
    });
}

export { clearAgentData };
