/**
 * 素材库 Schema 定义
 * 
 * 可见性规则：
 * - workspace_id = 'system' → 系统预置素材，所有用户可见
 * - workspace_id = 其他 → 用户私有素材，仅自己可见
 */

import { pgTable, text, timestamp, jsonb, uuid, integer, index } from 'drizzle-orm/pg-core';

/** 系统预置素材的 workspaceId */
export const SYSTEM_WORKSPACE_ID = 'system';

/** 素材类型 */
export type MaterialType = 'case' | 'data' | 'story' | 'quote' | 'opening' | 'ending';

/** 素材来源 */
export type MaterialSourceType = 'manual' | 'info_snippet' | 'task_download' | 'ai_generate' | 'system_import';

/** 素材状态 */
export type MaterialStatus = 'active' | 'archived' | 'draft';

export const materialLibrary = pgTable('material_library', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  type: text('type').notNull(),
  content: text('content').notNull(),
  sourceType: text('source_type').notNull().default('manual'),
  sourceDesc: text('source_desc'),
  sourceUrl: text('source_url'),
  topicTags: jsonb('topic_tags').$type<string[]>().default([]),
  sceneTags: jsonb('scene_tags').$type<string[]>().default([]),
  emotionTags: jsonb('emotion_tags').$type<string[]>().default([]),
  applicablePositions: jsonb('applicable_positions').$type<string[]>().default([]),
  vectorId: text('vector_id'),
  useCount: integer('use_count').notNull().default(0),
  lastUsedAt: timestamp('last_used_at'),
  effectiveCount: integer('effective_count').default(0),
  ineffectiveCount: integer('ineffective_count').default(0),
  status: text('status').notNull().default('active'),
  workspaceId: text('workspace_id').notNull(),  // 'system' = 系统预置，其他 = 用户私有
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  workspaceIdx: index('idx_material_workspace').on(table.workspaceId),
  typeIdx: index('idx_material_type').on(table.type),
}));

export type MaterialLibrary = typeof materialLibrary.$inferSelect;
export type NewMaterialLibrary = typeof materialLibrary.$inferInsert;

export const materialUsageLog = pgTable('material_usage_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  materialId: uuid('material_id').notNull().references(() => materialLibrary.id),
  articleId: text('article_id'),
  taskId: uuid('task_id'),
  commandResultId: text('command_result_id'),
  position: text('position'),
  effectiveness: text('effectiveness'),
  feedback: text('feedback'),
  workspaceId: text('workspace_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  materialIdx: index('idx_usage_material').on(table.materialId),
}));

export type MaterialUsageLog = typeof materialUsageLog.$inferSelect;
export type NewMaterialUsageLog = typeof materialUsageLog.$inferInsert;
