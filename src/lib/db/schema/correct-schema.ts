/**
 * ⚠️  正确的数据库 Schema 定义
 * 
 * 重要：此文件反映数据库的实际结构！
 * 在编写数据库代码时，请务必使用这个文件中的定义！
 * 
 * 生成时间：2026-02-24
 * 参考文档：DATABASE_SCHEMA_REFERENCE.md
 */

import { pgTable, text, timestamp, jsonb, uuid, integer, boolean, date } from 'drizzle-orm/pg-core';

// ==========================================
// 🔑 核心表定义（实际数据库字段）
// ==========================================

/**
 * daily_task 表 - 每日任务表
 * ⚠️  注意：表名是 daily_task，不是 daily_task！
 */
export const dailyTask = pgTable('daily_task', {
  id: uuid('id').primaryKey().defaultRandom(),
  commandId: text('command_id').notNull(),
  relatedTaskId: text('related_task_id').notNull(),
  taskDescription: text('task_description').notNull(),
  executor: text('executor').notNull(),
  taskPriority: text('task_priority').notNull().default('normal'),
  executionDeadlineStart: timestamp('execution_deadline_start').notNull(),
  executionDeadlineEnd: timestamp('execution_deadline_end').notNull(),
  deliverables: text('deliverables').notNull(),
  executionStatus: text('execution_status').notNull().default('new'),
  statusProof: text('status_proof'),
  helpRecord: text('help_record'),
  auditOpinion: text('audit_opinion'),
  splitter: text('splitter').notNull().default('agent B'),
  entryUser: text('entry_user').notNull().default('TS'),
  remarks: text('remarks'),
  lastTsCheckTime: timestamp('last_ts_check_time'),
  lastTsAwakeningTime: timestamp('last_ts_awakening_time'),
  tsAwakeningCount: integer('ts_awakening_count').notNull().default(0),
  lastInspectionTime: timestamp('last_inspection_time'),
  lastConsultTime: timestamp('last_consult_time'),
  awakeningCount: integer('awakening_count').notNull().default(0),
  taskId: text('task_id'),
  fromAgentId: text('from_agent_id').notNull(),
  toAgentId: text('to_agent_id').notNull(),
  originalCommand: text('original_command').notNull(),
  executionResult: text('execution_result'),
  outputData: jsonb('output_data').default({}),
  metrics: jsonb('metrics').default({}),
  attachments: jsonb('attachments').default([]),
  completedAt: timestamp('completed_at'),
  scenarioType: text('scenario_type'),
  taskName: text('task_name'),
  triggerSource: text('trigger_source'),
  retryStatus: text('retry_status'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  taskType: text('task_type').default('daily'),
  executionDate: date('execution_date'),
  rejectionReason: text('rejection_reason'),
  dependencies: jsonb('dependencies').default({}),
  sortOrder: integer('sort_order').default(0),
  completedSubTasks: integer('completed_sub_tasks').default(0),
  completedSubTasksDescription: text('completed_sub_tasks_description'),
  subTaskCount: integer('sub_task_count'), // ✅ 正确的字段名
  questionStatus: text('question_status'),
  lastCheckedAt: timestamp('last_checked_at'),
  lastInspectedAt: timestamp('last_inspected_at'),
  dialogueSessionId: text('dialogue_session_id'),
  dialogueRounds: integer('dialogue_rounds'),
  dialogueStatus: text('dialogue_status'),
  lastDialogueAt: timestamp('last_dialogue_at'),
  latestReportId: text('latest_report_id'),
  reportCount: integer('report_count'),
  requiresIntervention: boolean('requires_intervention'),
  taskTitle: text('task_title'),
  commandContent: text('command_content'),
  commandPriority: text('command_priority'),
  splitStartTime: timestamp('split_start_time'),
  // 多用户系统字段
  workspaceId: text('workspace_id'),
  // 创作引导字段
  userOpinion: text('user_opinion'),
  materialIds: text('material_ids'),
});

/**
 * agent_notifications 表 - Agent 通知表
 */
export const agentNotifications = pgTable('agent_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  notificationId: text('notification_id').notNull(), // ✅ 正确的字段名
  fromAgentId: text('from_agent_id').notNull(),
  toAgentId: text('to_agent_id').notNull(),
  notificationType: text('notification_type').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  relatedTaskId: text('related_task_id'),
  status: text('status').notNull().default('unread'),
  priority: text('priority').notNull().default('normal'),
  metadata: jsonb('metadata').default({}),
  isRead: boolean('is_read').notNull().default(false), // ✅ 正确的字段名
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  // ⚠️  注意：这个表没有 updated_at 字段！
});

/**
 * agent_sub_tasks 表 - Agent 子任务表
 */
export const agentSubTasks = pgTable('agent_sub_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  commandResultId: uuid('command_result_id').notNull().references(() => dailyTask.id, { onDelete: 'cascade' }),
  fromParentsExecutor: text('from_parents_executor').notNull(),
  taskTitle: text('task_title').notNull(), // ✅ 正确的字段名
  taskDescription: text('task_description'),
  status: text('status').notNull().default('pending'), // ✅ 正确的字段名
  orderIndex: integer('order_index').notNull(), // ✅ 正确的字段名
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  dialogueSessionId: text('dialogue_session_id'),
  dialogueRounds: integer('dialogue_rounds').default(0),
  dialogueStatus: text('dialogue_status').default('none'),
  lastDialogueAt: timestamp('last_dialogue_at'),
  executionResult: text('execution_result'),
  statusProof: text('status_proof'),
  isDispatched: boolean('is_dispatched').default(false),
  dispatchedAt: timestamp('dispatched_at'),
  timeoutHandlingCount: integer('timeout_handling_count').default(0),
  feedbackHistory: jsonb('feedback_history').default([]),
  lastFeedbackAt: timestamp('last_feedback_at'),
  escalated: boolean('escalated').default(false),
  escalatedAt: timestamp('escalated_at'),
  escalatedReason: text('escalated_reason'),
  // 多用户系统字段
  workspaceId: text('workspace_id'),
  // 创作引导字段
  executionDate: text('execution_date'),
  userOpinion: text('user_opinion'),
  materialIds: text('material_ids'),
  relatedMaterials: text('related_materials'),
  structureName: text('structure_name'),
  structureDetail: text('structure_detail'),
  // 文章结果字段
  articleMetadata: jsonb('article_metadata'),
  resultData: jsonb('result_data'),
  resultText: text('result_text'),
});

// ==========================================
// 📝 TypeScript 类型定义
// ==========================================

export type DailyTask = typeof dailyTask.$inferSelect;
export type NewDailyTask = typeof dailyTask.$inferInsert;

export type AgentNotification = typeof agentNotifications.$inferSelect;
export type NewAgentNotification = typeof agentNotifications.$inferInsert;

export type AgentSubTask = typeof agentSubTasks.$inferSelect;
export type NewAgentSubTask = typeof agentSubTasks.$inferInsert;

// ==========================================
// ⚠️  常见错误对照
// ==========================================

/**
 * 常见错误字段对照表
 * 
 * ❌ 错误的字段名          ✅ 正确的字段名            所在表
 * -----------------------  ------------------------  ------------------
 * dailyTask               daily_task                表对象/表名
 * notificationId          id / notification_id      agent_notifications
 * task_id (在子任务表)    不存在，用 command_result_id agent_sub_tasks
 * task_name (子任务)      task_title                agent_sub_tasks
 * execution_status (子)   status                    agent_sub_tasks
 * sort_order (子任务)     order_index               agent_sub_tasks
 * read                    is_read                   agent_notifications
 */
