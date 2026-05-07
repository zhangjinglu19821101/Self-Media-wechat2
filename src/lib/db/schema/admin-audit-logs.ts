/**
 * 管理员审计日志表
 * 记录管理员对用户的所有操作
 */

import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // 操作者信息
  adminId: uuid('admin_id').notNull(), // 执行操作的管理员 ID
  adminEmail: text('admin_email').notNull(), // 管理员邮箱
  
  // 被操作用户信息
  targetAccountId: uuid('target_account_id').notNull(), // 被操作的用户 ID
  targetEmail: text('target_email').notNull(), // 被操作用户邮箱
  
  // 操作详情
  action: text('action').notNull(), // 操作类型: disable/enable/unlock/reset_password/set_role
  actionDetail: text('action_detail'), // 操作详情描述
  previousValue: jsonb('previous_value'), // 操作前的值（如原角色、原状态等）
  newValue: jsonb('new_value'), // 操作后的值
  
  // 元数据
  ipAddress: text('ip_address'), // 操作者 IP
  userAgent: text('user_agent'), // 浏览器信息
  
  // 时间戳
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 操作类型常量
export const ADMIN_ACTION = {
  DISABLE: 'disable',           // 禁用用户
  ENABLE: 'enable',             // 启用用户
  UNLOCK: 'unlock',             // 解锁用户
  RESET_PASSWORD: 'reset_password', // 重置密码
  SET_ROLE: 'set_role',         // 设置角色
} as const;

export type AdminAction = typeof ADMIN_ACTION[keyof typeof ADMIN_ACTION];
