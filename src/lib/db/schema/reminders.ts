/**
 * 提醒表 Schema
 * 
 * 核心概念：谁要求谁做什么事情
 * 
 * 双视角设计：
 * - 出向（outbound）：我要求别人做什么
 * - 入向（inbound）：别人要求我做什么
 * 
 * 检索维度：
 * - 按人名（要求者/被要求者）
 * - 按状态（待完成/已逾期/已完成）
 * - 按内容关键词
 * - 按时间范围
 */

import { pgTable, text, timestamp, uuid, index, jsonb, varchar } from 'drizzle-orm/pg-core';

// ==================== 类型定义 ====================

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
 * 方向：出向(我要求别人) / 入向(别人要求我)
 */
export type Direction = 'outbound' | 'inbound';

// ==================== 表定义 ====================

/**
 * 提醒表
 */
export const reminders = pgTable('reminders', {
  id: uuid('id').primaryKey().defaultRandom(),

  // ===== 核心：谁要求谁做什么 =====
  requesterName: varchar('requester_name', { length: 100 }).notNull(),   // 要求者姓名
  assigneeName: varchar('assignee_name', { length: 100 }).notNull(),     // 被要求者姓名
  content: text('content').notNull(),                                      // 做什么事情

  // ===== 方向标记（冗余加速查询） =====
  /** 
   * 方向：相对于当前 workspace 的视角
   * outbound = 我要求别人（requesterName 是自己人）
   * inbound = 别人要求我（assigneeName 是自己人）
   */
  direction: varchar('direction', { length: 20 }).notNull().default('outbound'),

  // ===== 时间管理 =====
  remindAt: timestamp('remind_at').notNull(),           // 提醒/截止时间
  remindedAt: timestamp('reminded_at'),                 // 实际触发时间

  // ===== 状态 =====
  status: varchar('status', { length: 20 }).default('pending'), // pending/triggered/completed

  // ===== 重复 =====
  repeatMode: varchar('repeat_mode', { length: 20 }).default('once'), // once/daily/weekly/monthly

  // ===== 通知方式 =====
  notifyMethods: jsonb('notify_methods').$type<NotifyMethod[]>().default(['browser', 'popup']),

  // ===== 元数据 =====
  workspaceId: text('workspace_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  workspaceIdIdx: index('idx_reminders_workspace_id').on(table.workspaceId),
  statusIdx: index('idx_reminders_status').on(table.status),
  remindAtIdx: index('idx_reminders_remind_at').on(table.remindAt),
  directionIdx: index('idx_reminders_direction').on(table.direction),
  requesterIdx: index('idx_reminders_requester').on(table.requesterName),
  assigneeIdx: index('idx_reminders_assignee').on(table.assigneeName),
}));

// ==================== 常量 ====================

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
 * 方向中文标签
 */
export const DIRECTION_LABELS: Record<Direction, string> = {
  outbound: '我要求别人',
  inbound: '别人要求我',
};

/**
 * 状态中文标签
 */
export const STATUS_LABELS: Record<ReminderStatus, string> = {
  pending: '待完成',
  triggered: '已到期',
  completed: '已完成',
};
