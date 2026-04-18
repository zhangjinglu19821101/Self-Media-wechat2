/**
 * 问题上报数据库 Schema
 * 用于持久化存储 Agent 上报的问题
 */

import { pgTable, text, timestamp, jsonb, uuid, boolean } from 'drizzle-orm/pg-core';

/**
 * 问题上报表
 */
export const problemReports = pgTable('problem_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  fromAgentId: text('from_agent_id').notNull(),          // 上报的 Agent ID
  fromAgentName: text('from_agent_name').notNull(),      // 上报的 Agent 名称
  problemType: text('problem_type').notNull(),           // 问题类型
  priority: text('priority').notNull(),                   // 优先级
  title: text('title').notNull(),                         // 问题标题
  description: text('description').notNull(),             // 问题描述
  context: jsonb('context').$type<Record<string, any>>(), // 上下文信息
  suggestedSolution: text('suggested_solution'),         // 建议的解决方案
  status: text('status').notNull().default('pending'),    // 问题状态
  solutionType: text('solution_type'),                   // 解决方式
  assignedTo: text('assigned_to'),                       // 分配给谁
  solution: text('solution'),                            // 解决方案描述
  solutionLogs: jsonb('solution_logs').$type<string[]>(),// 解决过程日志
  humanInterventionNeeded: boolean('human_intervention_needed').default(false), // 是否需要人类介入
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at'),                  // 解决时间
});
