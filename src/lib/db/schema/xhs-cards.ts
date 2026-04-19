/**
 * 小红书卡片图片 Schema 定义
 * 存储小红书图文卡片的持久化记录
 *
 * 核心设计：
 * 1. 存储对象存储的 key，而非 URL（避免 URL 过期问题）
 * 2. 关联到具体的子任务，便于追溯
 * 3. 支持按卡片索引查询（封面/要点1/结尾）
 */

import { pgTable, text, timestamp, uuid, integer, index, boolean } from 'drizzle-orm/pg-core';

// ============================================================
// 类型定义
// ============================================================

/**
 * 卡片类型
 */
export type XhsCardType =
  | 'cover'    // 封面卡
  | 'point'    // 要点卡
  | 'ending';  // 结尾卡

/**
 * 卡片状态
 */
export type XhsCardStatus =
  | 'active'    // 正常可用
  | 'inactive'  // 已被新卡片组取代（旧组关联卡片）
  | 'expired'   // 已过期（对象存储文件已删除）
  | 'failed';   // 上传失败

// ============================================================
// 表定义
// ============================================================

/**
 * 小红书卡片图片表
 * 存储每张卡片的元信息和对象存储 key
 */
export const xhsCards = pgTable('xhs_cards', {
  // === 主键 ===
  id: uuid('id').primaryKey().defaultRandom(),

  // === 关联字段 ===
  subTaskId: text('sub_task_id'),           // 关联的子任务 ID
  commandResultId: text('command_result_id'), // 关联的指令结果 ID
  cardIndex: integer('card_index').notNull(), // 卡片序号（0=封面，1/2/3=要点，最后=结尾）
  cardType: text('card_type').notNull(),     // cover / point / ending

  // === 对象存储信息 ===
  storageKey: text('storage_key').notNull(), // 对象存储的 key（永久有效）
  fileFormat: text('file_format').notNull().default('png'), // 文件格式 png/jpeg/webp

  // === 卡片内容快照（便于搜索和预览）===
  titleSnapshot: text('title_snapshot'),     // 卡片标题快照（≤100字）
  contentSnapshot: text('content_snapshot'), // 卡片内容快照（≤500字）

  // === 元数据 ===
  width: integer('width').notNull().default(1080),  // 图片宽度
  height: integer('height').notNull().default(1440), // 图片高度
  fileSize: integer('file_size'),            // 文件大小（字节）
  gradientScheme: text('gradient_scheme'),   // 配色方案名称

  // === 状态 ===
  status: text('status').notNull().default('active'), // active / inactive / expired / failed
  isPublic: boolean('is_public').notNull().default(true), // 是否公开可访问

  // === 工作空间归属 ===
  workspaceId: text('workspace_id'),

  // === 时间戳 ===
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),        // 过期时间（NULL 表示永不过期）
}, (table) => ({
  idxXhsCardsSubTaskId: index('idx_xhs_cards_sub_task_id').on(table.subTaskId),
  idxXhsCardsCommandResultId: index('idx_xhs_cards_command_result_id').on(table.commandResultId),
  idxXhsCardsCardIndex: index('idx_xhs_cards_card_index').on(table.cardIndex),
  idxXhsCardsStatus: index('idx_xhs_cards_status').on(table.status),
  idxXhsCardsWorkspaceId: index('idx_xhs_cards_workspace_id').on(table.workspaceId),
  idxXhsCardsExpiresAt: index('idx_xhs_cards_expires_at').on(table.expiresAt),
}));

/**
 * 小红书卡片组表
 * 一次生成任务产生的一组卡片（封面+要点+结尾）
 */
export const xhsCardGroups = pgTable('xhs_card_groups', {
  // === 主键 ===
  id: uuid('id').primaryKey().defaultRandom(),

  // === 关联字段 ===
  subTaskId: text('sub_task_id').notNull(),           // 关联的子任务 ID
  commandResultId: text('command_result_id'), // 关联的指令结果 ID

  // === 卡片组信息 ===
  totalCards: integer('total_cards').notNull(),        // 总卡片数
  cardCountMode: text('card_count_mode').notNull(),    // 3-card / 5-card / 7-card
  gradientScheme: text('gradient_scheme'),             // 配色方案

  // === 文章信息快照 ===
  articleTitle: text('article_title'),                 // 文章标题
  articleIntro: text('article_intro'),                 // 文章引言

  // === 卡片 ID 列表（JSON 数组，按顺序存储卡片 ID）===
  cardIds: text('card_ids').notNull().default('[]'),   // JSON 数组：["uuid1", "uuid2", ...]

  // === 状态 ===
  status: text('status').notNull().default('active'),  // active / partial / superseded / failed
  // active: 全部卡片上传成功，当前有效
  // partial: 部分卡片上传失败
  // superseded: 已被新卡片组取代（不再有效）
  // failed: 全部上传失败

  // === 工作空间归属 ===
  workspaceId: text('workspace_id'),

  // === 时间戳 ===
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  idxXhsCardGroupsSubTaskId: index('idx_xhs_card_groups_sub_task_id').on(table.subTaskId),
  idxXhsCardGroupsCommandResultId: index('idx_xhs_card_groups_command_result_id').on(table.commandResultId),
  idxXhsCardGroupsStatus: index('idx_xhs_card_groups_status').on(table.status),
  idxXhsCardGroupsWorkspaceId: index('idx_xhs_card_groups_workspace_id').on(table.workspaceId),
}));

// ============================================================
// 类型导出（Drizzle 推断）
// ============================================================

export type XhsCard = typeof xhsCards.$inferSelect;
export type NewXhsCard = typeof xhsCards.$inferInsert;

export type XhsCardGroup = typeof xhsCardGroups.$inferSelect;
export type NewXhsCardGroup = typeof xhsCardGroups.$inferInsert;
