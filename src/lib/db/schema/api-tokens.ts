/**
 * API Token 表 Schema
 * 
 * 用于 App/小程序的 Bearer Token 认证
 * 
 * 设计：
 * - Access Token 是无状态 JWT，不存库
 * - Refresh Token 的 SHA-256 哈希存库，支持吊销和轮转
 * - 支持多设备管理（deviceType/deviceName/deviceId）
 */

import { pgTable, text, boolean, timestamp, uuid, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { accounts } from './auth';

// ==================== API Token 表 ====================

/** 设备类型 */
export type DeviceType = 'ios_app' | 'android_app' | 'wechat_miniprogram' | 'other';

export const VALID_DEVICE_TYPES: DeviceType[] = ['ios_app', 'android_app', 'wechat_miniprogram', 'other'];

export const apiTokens = pgTable('api_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 所属账户
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),

  // Refresh Token 的 SHA-256 哈希（不存明文）
  tokenHash: text('token_hash').notNull().unique(),

  // 设备信息
  deviceName: text('device_name'),       // "iPhone 15 Pro", "微信小程序"
  deviceType: text('device_type').notNull(), // 'ios_app' | 'android_app' | 'wechat_miniprogram' | 'other'
  deviceId: text('device_id'),           // 设备唯一标识（同设备多 Token 去重）

  // 绑定 Workspace（可选，Token 可切换）
  workspaceId: uuid('workspace_id'),

  // 安全
  isRevoked: boolean('is_revoked').default(false),
  revokedAt: timestamp('revoked_at'),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at').notNull(), // Refresh Token 过期时间

  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxApiTokensAccount: index('idx_api_tokens_account').on(table.accountId),
  idxApiTokensHash: index('idx_api_tokens_hash').on(table.tokenHash),
  idxApiTokensExpires: index('idx_api_tokens_expires').on(table.expiresAt),
  // P1-6: 复合索引，优化 listActiveTokens 和 rotateRefreshToken 查询
  idxApiTokensAccountActive: index('idx_api_tokens_account_active').on(table.accountId, table.isRevoked, table.expiresAt),
}));

// ==================== 关系定义 ====================

export const apiTokensRelations = relations(apiTokens, ({ one }) => ({
  account: one(accounts, {
    fields: [apiTokens.accountId],
    references: [accounts.id],
  }),
}));

// ==================== 类型导出 ====================

export type ApiToken = typeof apiTokens.$inferSelect;
export type NewApiToken = typeof apiTokens.$inferInsert;
