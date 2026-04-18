/**
 * 用户 API Key 管理 Schema
 * 
 * 用于 BYOK（Bring Your Own Key）模式：
 * 用户填入自己的豆包 API Key，系统优先使用用户 Key 调用 LLM
 * 
 * 安全设计：
 * - API Key 使用 AES-256-GCM 加密存储（不存明文）
 * - 加密密钥从环境变量 COZE_ENCRYPTION_KEY 读取
 * - 每个加密操作使用随机 IV + Tag，防止重放攻击
 */

import { pgTable, text, timestamp, uuid, boolean, index } from 'drizzle-orm/pg-core';

// ==================== Provider 类型 ====================

export type LLMProvider = 'doubao';

/** Provider 标签映射 */
export const PROVIDER_LABELS: Record<LLMProvider, string> = {
  doubao: '豆包（火山引擎）',
};

/** Provider 选项列表（前端下拉使用） */
export const PROVIDER_OPTIONS: Array<{ value: LLMProvider; label: string }> = [
  { value: 'doubao', label: '豆包（火山引擎）' },
];

// ==================== Key 状态 ====================

export type ApiKeyStatus = 'active' | 'disabled' | 'invalid';

// ==================== 表定义 ====================

export const userApiKeys = pgTable('user_api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 所属工作空间（多租户隔离）
  workspaceId: uuid('workspace_id').notNull(),

  // Provider 类型
  provider: text('provider').notNull().default('doubao'),

  // 加密后的 API Key（AES-256-GCM）
  // 格式：base64(encrypted_data)，不含 IV 和 Tag
  encryptedKey: text('encrypted_key').notNull(),

  // GCM 初始化向量（12 字节，base64 编码）
  keyIv: text('key_iv').notNull(),

  // GCM 认证标签（16 字节，base64 编码）
  keyTag: text('key_tag').notNull(),

  // 脱敏展示用：仅存储最后 4 位（如 sk-****abcd）
  keySuffix: text('key_suffix'),

  // 状态
  status: text('status').notNull().default('active'), // active / disabled / invalid

  // 最后验证时间（调用 list models 确认 Key 有效）
  lastVerifiedAt: timestamp('last_verified_at'),

  // 最后验证结果
  lastVerifyError: text('last_verify_error'),

  // 备注/别名（用户自定义，如"主账号Key"、"测试Key"）
  displayName: text('display_name'),

  // 时间戳
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  // 按 workspace 快速查询
  index('idx_user_api_keys_workspace_id').on(table.workspaceId),
  // 按 workspace + status 组合查询活跃 Key
  index('idx_user_api_keys_workspace_status').on(table.workspaceId, table.status),
]);

// ==================== TypeScript 类型导出 ====================

export type UserApiKey = typeof userApiKeys.$inferSelect;
export type NewUserApiKey = typeof userApiKeys.$inferInsert;
