/**
 * 信息速记 Schema 定义
 * 用于随时随地快速记录零散的行业信息（报告、数据来源等）
 * 后续可整理转化为正式素材
 */

import { pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core';

/**
 * 信息速记表
 * 记录用户随时收集的零散行业信息
 */
export const infoSnippets = pgTable('info_snippets', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // 核心信息（必填）
  title: text('title').notNull(),           // 报告/信息名称
  sourceOrg: text('source_org').notNull(),   // 发布机构
  publishDate: text('publish_date'),         // 发布时间（文本格式，灵活）
  url: text('url'),                         // 直达链接
  
  // 内容（必填）
  highlights: text('highlights').notNull(),  // 核心数据亮点/摘要
  
  // 元数据
  status: text('status').notNull().default('pending'), // pending(待整理) | organized(已整理)
  userId: text('user_id'),
  workspaceId: text('workspace_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // 索引
  statusIdx: index('idx_info_snippet_status').on(table.status),
  userIdIdx: index('idx_info_snippet_user_id').on(table.userId),
  workspaceIdIdx: index('idx_info_snippets_workspace_id').on(table.workspaceId),
  createdAtIdx: index('idx_info_snippet_created_at').on(table.createdAt),
}));
