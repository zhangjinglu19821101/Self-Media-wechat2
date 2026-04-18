import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

/**
 * Agent 通知表
 * 用于存储 Agent 间的所有通知（指令、任务结果、系统通知）
 */
export const agentNotifications = pgTable('agent_notifications', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'new_command' | 'task_result' | 'system_notification'
  toAgentId: text('to_agent_id').notNull(), // 接收通知的 Agent ID
  fromAgentId: text('from_agent_id'), // 发送通知的 Agent ID（可选）
  taskId: text('task_id'), // 关联的任务 ID（可选）
  command: text('command'), // 指令内容（可选）
  result: text('result'), // 执行结果（可选）
  status: text('status'), // 任务状态（可选）
  message: text('message'), // 系统通知消息（可选）
  data: jsonb('data'), // 附加数据（可选）
  read: text('read').notNull().default('false'), // 是否已读取
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
