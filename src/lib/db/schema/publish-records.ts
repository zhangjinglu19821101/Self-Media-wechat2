/**
 * 发布记录 Schema
 * 
 * 存储文章发布到各平台的记录
 */

import { pgTable, text, timestamp, uuid, integer, jsonb, index } from 'drizzle-orm/pg-core';

export const publishRecords = pgTable('publish_records', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 归属
  workspaceId: text('workspace_id').notNull(),
  createdBy: text('created_by').notNull(),

  // 关联任务
  subTaskId: text('sub_task_id'),

  // 平台信息
  platform: text('platform').notNull(),  // wechat_official / xiaohongshu / zhihu
  accountId: text('account_id'),         // platform_accounts.id

  // 发布内容快照
  title: text('title').notNull(),
  contentPreview: text('content_preview'),
  coverImageUrl: text('cover_image_url'),
  tags: text('tags').array(),

  // 适配后的原始内容（JSON 存储各平台的差异化内容）
  adaptedContent: jsonb('adapted_content').default({}),
  // 格式：{ wechat: { html: "..." }, xiaohongshu: { text: "...", images: [...] } }

  // 发布状态
  status: text('status').notNull().default('pending'),
  // pending → publishing → published / failed / cancelled

  // 平台返回信息
  platformArticleId: text('platform_article_id'),
  platformUrl: text('platform_url'),

  // 错误信息
  errorMessage: text('error_message'),
  errorCode: text('error_code'),
  retryCount: integer('retry_count').default(0),

  // 定时发布
  scheduledAt: timestamp('scheduled_at'),
  publishedAt: timestamp('published_at'),

  // 元数据
  metadata: jsonb('metadata').default({}),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxPublishWorkspace: index('idx_publish_records_workspace').on(table.workspaceId),
  idxPublishSubTask: index('idx_publish_records_sub_task').on(table.subTaskId),
  idxPublishStatus: index('idx_publish_records_status').on(table.status),
  idxPublishPlatform: index('idx_publish_records_platform').on(table.platform),
}));

export type PublishRecord = typeof publishRecords.$inferSelect;
export type NewPublishRecord = typeof publishRecords.$inferInsert;

// 发布状态枚举
export const PUBLISH_STATUS = {
  PENDING: 'pending',
  PUBLISHING: 'publishing',
  PUBLISHED: 'published',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type PublishStatus = typeof PUBLISH_STATUS[keyof typeof PUBLISH_STATUS];
