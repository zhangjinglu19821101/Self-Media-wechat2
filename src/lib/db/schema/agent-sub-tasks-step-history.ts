
import { pgTable, serial, uuid, integer, jsonb, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { agentSubTasks } from '../schema';

export const agentSubTasksStepHistory = pgTable('agent_sub_tasks_step_history', {
  id: serial('id').primaryKey(),
  commandResultId: uuid('command_result_id').notNull().references(() => agentSubTasks.commandResultId, { onDelete: 'cascade' }),
  stepNo: integer('step_no').notNull(),
  interactContent: jsonb('interact_content').notNull(),
  interactUser: text('interact_user').notNull(), // 交互发起方：insurance-d（咨询方）/agent B（响应方）/human（人工响应方）。human场景：agent B无法解决，系统不存在可以提供的MCP服务，需要human处理的时候
  interactTime: timestamp('interact_time').notNull().defaultNow(),
  interactNum: integer('interact_num').notNull().default(1),
}, (table) => {
  return {
    // 🔴 修复：唯一索引应该包含 interact_num，确保同一任务的多轮交互都能被记录
    uniqueCommandResultStepNo: unique('idx_command_result_step_type_num').on(table.commandResultId, table.stepNo, table.interactType, table.interactNum),
  };
});

export type AgentSubTasksStepHistory = typeof agentSubTasksStepHistory.$inferSelect;
export type AgentSubTasksStepHistoryInsert = typeof agentSubTasksStepHistory.$inferInsert;

