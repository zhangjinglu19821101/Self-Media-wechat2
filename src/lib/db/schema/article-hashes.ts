/**
 * 文章哈希表 Schema
 * 用于文章去重检测
 */

import { pgTable, uuid, text, bigint, timestamp, jsonb } from 'drizzle-orm/pg-core';

/**
 * 文章哈希记录表
 * 存储已分析文章的哈希指纹，用于去重检测
 */
export const articleHashes = pgTable('article_hashes', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: text('workspace_id'),
  articleTitle: text('article_title'),
  
  // 哈希指纹
  sha256: text('sha256').notNull(),           // SHA-256 原始内容哈希（精确匹配）
  normalizedSha256: text('normalized_sha256').notNull(),  // SHA-256 规范化内容哈希（格式无关匹配）
  simHash: text('sim_hash').notNull(),  // SimHash 指纹（TEXT存储，避免BIGINT溢出）
  contentLength: bigint('content_length', { mode: 'number' }).notNull(),
  
  // 关联信息
  templateId: uuid('template_id'),            // 关联的风格模板
  
  // 缓存分析结果（避免重复分析）
  cachedAnalysis: jsonb('cached_analysis'),   // 缓存的 6 维度分析结果
  
  // 时间戳
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type ArticleHash = typeof articleHashes.$inferSelect;
export type NewArticleHash = typeof articleHashes.$inferInsert;
