/**
 * 素材库 Schema 定义
 * 存储可复用的创作素材：案例、数据、故事、引用等
 * 
 * 支持两种归属：
 * - owner_type='system': 系统素材（所有用户可见，管理员管理）
 * - owner_type='user':   用户素材（绑定 workspaceId，用户私有）
 */

import { pgTable, text, timestamp, jsonb, uuid, integer, index } from 'drizzle-orm/pg-core';

/** 系统预置素材的 workspaceId */
export const SYSTEM_WORKSPACE_ID = 'system';

/**
 * 素材来源类型
 */
export type MaterialSourceType =
  | 'manual'         // 手动创建
  | 'article'        // 从文章提取
  | 'ai_generate'    // AI生成
  | 'import'         // 外部导入
  | 'system_admin'   // 管理员录入（系统素材）
  | 'system_crawl'   // 系统爬取（系统素材）
  | 'info_snippet'   // 信息速记转换
  | 'web_search';    // 网络搜索保存

/** 素材状态 */
export type MaterialStatus = 'active' | 'archived' | 'draft';

/**
 * 素材归属类型
 */
export type MaterialOwnerType = 
  | 'system'      // 系统素材（所有用户可见）
  | 'user';       // 用户素材（绑定 workspaceId）

/**
 * 有效素材来源类型常量
 */
export const VALID_SOURCE_TYPES: string[] = [
  'manual', 'article', 'ai_generate', 'import',
  'system_admin', 'system_crawl', 'info_snippet', 'web_search',
];

/**
 * 系统素材专属来源类型
 * 仅管理员创建系统素材时可使用
 */
export const SYSTEM_SOURCE_TYPES: string[] = ['system_admin', 'system_crawl'];

/**
 * 素材库表
 * 核心字段：标题、类型、内容、来源、标签、归属
 */
export const materialLibrary = pgTable('material_library', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // === 核心内容（必须） ===
  title: text('title').notNull(),                    // 素材标题
  type: text('type').notNull(),                      // 素材类型：case/data/story/quote/opening/ending
  content: text('content').notNull(),                // 素材内容
  
  // === 归属信息 ===
  ownerType: text('owner_type').notNull().default('user'),  // 归属类型：system/user
  workspaceId: text('workspace_id'),                        // 工作区ID（系统素材为 NULL）

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
  
  // === 时间戳 ===
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  workspaceIdx: index('idx_material_workspace').on(table.workspaceId),
  typeIdx: index('idx_material_type').on(table.type),
  statusIdx: index('idx_material_status').on(table.status),
  workspaceIdIdx: index('idx_material_workspace_id').on(table.workspaceId),
  useCountIdx: index('idx_material_use_count').on(table.useCount),
  ownerTypeIdx: index('idx_material_owner_type').on(table.ownerType),
  ownerStatusIdx: index('idx_material_owner_status').on(table.ownerType, table.status),
  // GIN索引：支持JSONB数组查询
  topicTagsIdx: index('idx_material_topic_tags').using('gin', table.topicTags),
  sceneTagsIdx: index('idx_material_scene_tags').using('gin', table.sceneTags),
}));

/**
 * 素材收藏表
 * 用户收藏系统素材或自己的素材，方便快速查找
 */
export const materialBookmarks = pgTable('material_bookmarks', {
  id: uuid('id').primaryKey().defaultRandom(),
  materialId: uuid('material_id').notNull().references(() => materialLibrary.id, { onDelete: 'cascade' }),
  workspaceId: text('workspace_id').notNull(),  // 收藏者工作区
  userTags: jsonb('user_tags').$type<string[]>().default([]),  // 用户自定义标签
  notes: text('notes'),                         // 用户备注
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  materialIdx: index('idx_bookmark_material_id').on(table.materialId),
  workspaceIdx: index('idx_bookmark_workspace_id').on(table.workspaceId),
  uniqueBookmark: index('idx_bookmark_unique').on(table.materialId, table.workspaceId),
}));

/**
 * 素材使用记录表
 * 记录素材在哪些文章中使用过
 */
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
export type MaterialBookmark = typeof materialBookmarks.$inferSelect;
export type NewMaterialBookmark = typeof materialBookmarks.$inferInsert;
