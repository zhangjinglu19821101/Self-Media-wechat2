/**
 * 认证系统 Schema 定义
 * 
 * Workspace 架构：
 * - accounts: 自然人身份（登录凭证）
 * - workspaces: 资源容器（所有业务数据归属于 workspace）
 * - workspace_members: 成员关系（Account ↔ Workspace）
 * - account_sessions: 会话管理
 * 
 * 设计原则：
 * - Account 是身份凭证，不存储业务数据
 * - Workspace 是资源容器，所有业务数据归属此
 * - 一个 Account 可以属于多个 Workspace
 */

import { pgTable, text, boolean, timestamp, uuid, integer, jsonb, index, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ==================== 账户表 ====================

// 系统级角色
export enum AccountRole {
  SUPER_ADMIN = 'super_admin',  // 超级管理员 - 跨 Workspace 权限
  NORMAL = 'normal',            // 普通用户 - 默认值
}

export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 登录凭证
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false),
  passwordHash: text('password_hash').notNull(),

  // 基本信息
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  phone: text('phone'),

  // 系统级角色（super_admin 可跨 Workspace 管理）
  role: text('role').notNull().default('normal'),

  // 账号状态（super_admin 可禁用账号）
  status: text('status').notNull().default('active'), // active / disabled / suspended

  // 安全
  failedLoginAttempts: integer('failed_login_attempts').default(0),
  lockedUntil: timestamp('locked_until'),

  // 偏好
  timezone: text('timezone').default('Asia/Shanghai'),
  locale: text('locale').default('zh-CN'),

  // 时间戳
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
  lastLoginIp: text('last_login_ip'),
});

// ==================== 工作空间表 ====================

export const workspaces = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 基本信息
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),

  // 类型：personal=个人（注册时自动创建）/ enterprise=企业
  type: text('type').notNull().default('personal'),

  // 所有者
  ownerAccountId: uuid('owner_account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),

  // 企业信息
  companyName: text('company_name'),

  // 状态：active=正常 / disabled=已禁用（超管操作）
  status: text('status').notNull().default('active'),

  // LLM Key 来源策略（超管控制）：
  // 'platform_credits' = 使用平台积分（默认，费用由平台承担）
  // 'user_key' = 使用用户自有 Key（用户需在设置页配置豆包 API Key）
  llmKeySource: text('llm_key_source').notNull().default('platform_credits'),

  // 时间戳
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxWorkspacesOwner: index('idx_workspaces_owner').on(table.ownerAccountId),
  idxWorkspacesType: index('idx_workspaces_type').on(table.type),
  idxWorkspacesStatus: index('idx_workspaces_status').on(table.status),
}));

// ==================== 成员关系表 ====================

export const workspaceMembers = pgTable('workspace_members', {
  id: uuid('id').defaultRandom().primaryKey(),

  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),

  // 角色：owner / admin / editor / viewer
  role: text('role').notNull().default('viewer'),

  // 状态
  status: text('status').notNull().default('active'), // active / pending_invitation / removed / left

  // 邀请信息
  invitedBy: uuid('invited_by').references(() => accounts.id),
  invitedAt: timestamp('invited_at').defaultNow(),
  joinedAt: timestamp('joined_at'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // 每个账户在每个工作空间只有一条记录
  uniqueWorkspaceMember: unique('idx_workspace_members_unique').on(table.workspaceId, table.accountId),
  idxWorkspaceMembersAccount: index('idx_workspace_members_account').on(table.accountId),
}));

// ==================== 会话表 ====================

export const accountSessions = pgTable('account_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  deviceInfo: jsonb('device_info'),
  ipAddress: text('ip_address'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  idxSessionsAccount: index('idx_sessions_account').on(table.accountId),
  idxSessionsToken: index('idx_sessions_token').on(table.token),
}));

// ==================== 关系定义 ====================

export const accountsRelations = relations(accounts, ({ many }) => ({
  ownedWorkspaces: many(workspaces),
  memberships: many(workspaceMembers),
  sessions: many(accountSessions),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(accounts, {
    fields: [workspaces.ownerAccountId],
    references: [accounts.id],
    relationName: 'workspaceOwner',
  }),
  members: many(workspaceMembers),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
  account: one(accounts, {
    fields: [workspaceMembers.accountId],
    references: [accounts.id],
  }),
  inviter: one(accounts, {
    fields: [workspaceMembers.invitedBy],
    references: [accounts.id],
    relationName: 'memberInviter',
  }),
}));

export const accountSessionsRelations = relations(accountSessions, ({ one }) => ({
  account: one(accounts, {
    fields: [accountSessions.accountId],
    references: [accounts.id],
  }),
}));

// ==================== 类型导出 ====================

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;
export type AccountSession = typeof accountSessions.$inferSelect;

// ==================== 角色枚举 ====================

export enum WorkspaceRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

// 账号状态
export const ACCOUNT_STATUS = {
  ACTIVE: 'active',
  DISABLED: 'disabled',     // 管理员禁用
  SUSPENDED: 'suspended',   // 系统自动暂停（如登录失败过多）
} as const;

export const WORKSPACE_TYPE = {
  PERSONAL: 'personal',
  ENTERPRISE: 'enterprise',
} as const;

// LLM Key 来源策略（超管控制）
export type LlmKeySource = 'platform_credits' | 'user_key';

export const LLM_KEY_SOURCE_OPTIONS: Array<{ value: LlmKeySource; label: string; description: string }> = [
  { value: 'platform_credits', label: '平台积分', description: '使用 Coze 平台 Key，费用由平台承担' },
  { value: 'user_key', label: '自有 Key', description: '使用用户配置的豆包 API Key，费用由用户承担' },
];

export const LLM_KEY_SOURCE_LABELS: Record<LlmKeySource, string> = {
  platform_credits: '平台积分',
  user_key: '自有 Key',
};

export const MEMBER_STATUS = {
  ACTIVE: 'active',
  PENDING_INVITATION: 'pending_invitation',
  REMOVED: 'removed',
  LEFT: 'left',
} as const;
