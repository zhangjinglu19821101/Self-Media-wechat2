/**
 * 提醒表 Schema
 * 
 * 与信息速记（info_snippets）分离，专注于提醒场景：
 * - 提醒内容：简短描述
 * - 提醒时间：核心字段
 * - 提醒方式：浏览器通知/页面弹窗/声音
 * - 重复模式：单次/每天/每周/每月
 * - 状态管理：待提醒/已触发/已完成
 */

import { pgTable, text, timestamp, uuid, index, jsonb, varchar } from 'drizzle-orm/pg-core';

/**
 * 提醒状态
 */
export type ReminderStatus = 'pending' | 'triggered' | 'completed';

/**
 * 重复模式
 */
export type RepeatMode = 'once' | 'daily' | 'weekly' | 'monthly';

/**
 * 通知方式
 */
export type NotifyMethod = 'browser' | 'popup' | 'sound';

/**
 * 提醒表
 */
export const reminders = pgTable('reminders', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // 提醒内容
  content: text('content').notNull(),           // 提醒内容（简短描述）
  
  // 提醒时间（核心字段）
  remindAt: timestamp('remind_at').notNull(),   // 提醒时间
  remindedAt: timestamp('reminded_at'),         // 实际触发时间
  
  // 状态
  status: varchar('status', { length: 20 }).default('pending'), // pending/triggered/completed
  
  // 重复模式
  repeatMode: varchar('repeat_mode', { length: 20 }).default('once'), // once/daily/weekly/monthly
  
  // 通知方式（多选）
  notifyMethods: jsonb('notify_methods').$type<NotifyMethod[]>().default(['browser', 'popup']),
  
  // 元数据
  workspaceId: text('workspace_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // 索引
  workspaceIdIdx: index('idx_reminders_workspace_id').on(table.workspaceId),
  statusIdx: index('idx_reminders_status').on(table.status),
  remindAtIdx: index('idx_reminders_remind_at').on(table.remindAt),
}));

/**
 * 重复模式中文标签
 */
export const REPEAT_MODE_LABELS: Record<RepeatMode, string> = {
  once: '仅一次',
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
};

/**
 * 通知方式中文标签
 */
export const NOTIFY_METHOD_LABELS: Record<NotifyMethod, string> = {
  browser: '浏览器通知',
  popup: '页面弹窗',
  sound: '声音提示',
};

/**
 * 状态中文标签
 */
export const STATUS_LABELS: Record<ReminderStatus, string> = {
  pending: '待提醒',
  triggered: '已触发',
  completed: '已完成',
};
