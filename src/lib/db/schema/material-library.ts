/**
 * 素材库 Schema 定义
 * 存储可复用的创作素材：案例、数据、故事、引用等
 */

import { pgTable, text, timestamp, jsonb, uuid, integer, numeric, index } from 'drizzle-orm/pg-core';

/**
 * 素材类型枚举
 */
export type MaterialType = 
  | 'case'        // 案例素材
  | 'data'        // 数据素材
  | 'story'       // 故事素材
  | 'quote'       // 引用素材
  | 'opening'     // 开头素材
  | 'ending';     // 结尾素材

/**
 * 素材来源类型
 */
export type MaterialSourceType =
  | 'manual'      // 手动创建
  | 'article'     // 从文章提取
  | 'ai_generate' // AI生成
  | 'import';     // 外部导入

/**
 * 素材状态
 */
export type MaterialStatus = 
  | 'active'      // 活跃
  | 'archived'    // 已归档
  | 'draft';      // 草稿

/**
 * 素材库表
 * 核心字段：标题、类型、内容、来源、标签
 */
export const materialLibrary = pgTable('material_library', {
  // === 主键 ===
  id: uuid('id').primaryKey().defaultRandom(),
  
  // === 核心内容（必须） ===
  title: text('title').notNull(),                    // 素材标题
  type: text('type').notNull(),                      // 素材类型：case/data/story/quote/opening/ending
  content: text('content').notNull(),                // 素材内容
  
  // === 来源信息 ===
  sourceType: text('source_type').notNull().default('manual'),  // 来源类型
  sourceDesc: text('source_desc'),                              // 来源描述（如：原创、XX报告、XX新闻）
  sourceUrl: text('source_url'),                                // 来源链接（如有）
  
  // === 标签系统（多维度检索） ===
  topicTags: jsonb('topic_tags').$type<string[]>().default([]),     // 主题标签：港险、重疾、医疗险
  sceneTags: jsonb('scene_tags').$type<string[]>().default([]),     // 场景标签：开头案例、收益对比
  emotionTags: jsonb('emotion_tags').$type<string[]>().default([]), // 情绪标签：踩坑、避坑、省钱
  
  // === 适用信息 ===
  applicablePositions: jsonb('applicable_positions').$type<string[]>().default([]), // 适用位置：opening/body/conclusion
  
  // === 向量ID（预留，后续升级用） ===
  vectorId: text('vector_id'),  // 向量数据库中的ID
  
  // === 使用统计 ===
  useCount: integer('use_count').notNull().default(0),       // 使用次数
  lastUsedAt: timestamp('last_used_at'),                     // 最后使用时间
  
  // === 效果统计 ===
  effectiveCount: integer('effective_count').default(0),     // 有效次数
  ineffectiveCount: integer('ineffective_count').default(0), // 无效次数
  
  // === 状态 ===
  status: text('status').notNull().default('active'),  // active/archived/draft
  
  // === 工作空间归属（由 user_id 重命名而来）===
  workspaceId: text('workspace_id'),
  
  // === 时间戳 ===
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // 索引：支持快速查询
  typeIdx: index('idx_material_type').on(table.type),
  statusIdx: index('idx_material_status').on(table.status),
  workspaceIdIdx: index('idx_material_workspace_id').on(table.workspaceId),
  useCountIdx: index('idx_material_use_count').on(table.useCount),
  // GIN索引：支持JSONB数组查询
  topicTagsIdx: index('idx_material_topic_tags').using('gin', table.topicTags),
  sceneTagsIdx: index('idx_material_scene_tags').using('gin', table.sceneTags),
}));

/**
 * 素材使用记录表
 * 记录素材在哪些文章中使用过
 */
export const materialUsageLog = pgTable('material_usage_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  materialId: uuid('material_id').notNull().references(() => materialLibrary.id, { onDelete: 'cascade' }),
  
  // === 使用场景 ===
  articleId: text('article_id'),           // 关联的文章ID
  articleTitle: text('article_title'),     // 文章标题
  usedPosition: text('used_position'),     // 使用位置：opening/body/conclusion
  
  // === 使用效果 ===
  effectType: text('effect_type'),         // 效果类型：good/neutral/bad
  
  // === 时间戳 ===
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  materialIdx: index('idx_usage_material_id').on(table.materialId),
  articleIdx: index('idx_usage_article_id').on(table.articleId),
}));

// === 类型导出 ===
export type MaterialLibrary = typeof materialLibrary.$inferSelect;
export type NewMaterial = typeof materialLibrary.$inferInsert;
export type MaterialUsageLog = typeof materialUsageLog.$inferSelect;
export type NewMaterialUsageLog = typeof materialUsageLog.$inferInsert;
