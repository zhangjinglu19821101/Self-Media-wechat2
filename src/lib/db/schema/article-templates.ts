/**
 * 文章排版模板数据库 Schema
 */

import { pgTable, uuid, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core';

export const articleTemplates = pgTable('article_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().default('default-user'),
  name: text('name').notNull(),
  htmlContent: text('html_content').notNull(),
  platform: text('platform').notNull().default('wechat_official'),
  isSystem: boolean('is_system').notNull().default(false),
  isDefault: boolean('is_default').notNull().default(false),
  useCount: integer('use_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type ArticleTemplate = typeof articleTemplates.$inferSelect;
export type NewArticleTemplate = typeof articleTemplates.$inferInsert;
