/**
 * 样式模板数据库 Schema
 */

import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

/**
 * 样式模板表
 */
export const styleTemplates = pgTable('style_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // 基础信息
  name: text('name').notNull(),                          // 模板名称（用户填写）
  
  // 样式内容
  htmlContent: text('html_content').notNull(),           // HTML 样式代码（用户粘贴）
  
  // 分类
  platform: text('platform').notNull().default('公众号'), // 平台：公众号/小红书/知乎
  
  // 类型
  isSystem: boolean('is_system').notNull().default(false), // 是否系统模板（系统模板不可删除）
  
  // 默认模板
  isDefault: boolean('is_default').notNull().default(false), // 是否为该平台的默认模板
  
  // 统计
  useCount: integer('use_count').notNull().default(0),   // 使用次数
  
  // 时间戳
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 类型导出
export type StyleTemplate = typeof styleTemplates.$inferSelect;
export type NewStyleTemplate = typeof styleTemplates.$inferInsert;
