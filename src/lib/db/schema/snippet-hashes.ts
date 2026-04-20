/**
 * 信息速记哈希表 Schema
 * 
 * 用于去重检测，存储速记内容的哈希值：
 * 1. SHA-256 哈希 - 检测完全相同的内容
 * 2. 规范化 SHA-256 - 检测格式不同但内容相同的内容
 * 3. SimHash 海明距离 - 检测近似相同的内容
 */

import { pgTable, text, timestamp, uuid, index, jsonb } from 'drizzle-orm/pg-core';

/**
 * 信息速记哈希表
 */
export const snippetHashes = pgTable('snippet_hashes', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // 关联字段
  snippetId: uuid('snippet_id'),             // 关联的速记 ID
  workspaceId: text('workspace_id'),         // 工作空间 ID
  
  // 哈希值
  sha256: text('sha256').notNull(),          // 原始内容 SHA-256
  normalizedSha256: text('normalized_sha256').notNull(), // 规范化内容 SHA-256
  simHash: text('sim_hash').notNull(),       // SimHash 指纹（TEXT存储，避免BIGINT溢出）
  contentLength: text('content_length').notNull(), // 内容长度
  
  // 内容摘要（用于展示）
  contentPreview: text('content_preview'),   // 内容预览（前100字）
  
  // 缓存的分析结果（避免重复调用 LLM）
  cachedAnalysis: jsonb('cached_analysis'),  // AI 分析结果缓存
  
  // 时间戳
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // 索引
  sha256Idx: index('idx_snippet_hashes_sha256').on(table.sha256),
  normalizedSha256Idx: index('idx_snippet_hashes_normalized_sha256').on(table.normalizedSha256),
  workspaceIdx: index('idx_snippet_hashes_workspace_id').on(table.workspaceId),
  snippetIdx: index('idx_snippet_hashes_snippet_id').on(table.snippetId),
}));
