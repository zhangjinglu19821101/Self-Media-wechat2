/**
 * 提醒服务层
 * 
 * 提供 CRUD 操作和时间分组功能
 */

import { db } from '@/lib/db';
import { reminders, type ReminderStatus, type RepeatMode, type NotifyMethod } from '@/lib/db/schema/reminders';
import { eq, and, desc, lte, gte, lt, gt, isNull, sql } from 'drizzle-orm';

// ================================================================
// 类型定义
// ================================================================

export interface ReminderData {
  id: string;
  content: string;
  remindAt: Date;
  remindedAt: Date | null;
  status: ReminderStatus;
  repeatMode: RepeatMode;
  notifyMethods: NotifyMethod[];
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReminderInput {
  content: string;
  remindAt: Date;
  repeatMode?: RepeatMode;
  notifyMethods?: NotifyMethod[];
  workspaceId: string;
}

export interface UpdateReminderInput {
  content?: string;
  remindAt?: Date;
  repeatMode?: RepeatMode;
  notifyMethods?: NotifyMethod[];
}

export interface ReminderGroup {
  label: string;           // 分组标签：今天/明天/本周/更晚/逾期
  key: string;             // 分组键：today/tomorrow/thisWeek/later/overdue
  reminders: ReminderData[];
  isOverdue: boolean;      // 是否逾期
}

// ================================================================
// CRUD 操作
// ================================================================

/**
 * 创建提醒
 */
export async function createReminder(input: CreateReminderInput): Promise<ReminderData> {
  const [reminder] = await db.insert(reminders).values({
    content: input.content,
    remindAt: input.remindAt,
    repeatMode: input.repeatMode || 'once',
    notifyMethods: input.notifyMethods || ['browser', 'popup'],
    workspaceId: input.workspaceId,
    status: 'pending',
  }).returning();

  return reminder as ReminderData;
}

/**
 * 获取提醒详情
 */
export async function getReminder(id: string, workspaceId: string): Promise<ReminderData | null> {
  const result = await db.select().from(reminders).where(
    and(eq(reminders.id, id), eq(reminders.workspaceId, workspaceId))
  );
  return result[0] as ReminderData || null;
}

/**
 * 更新提醒
 */
export async function updateReminder(
  id: string,
  workspaceId: string,
  input: UpdateReminderInput
): Promise<ReminderData | null> {
  const updateData: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (input.content !== undefined) updateData.content = input.content;
  if (input.remindAt !== undefined) updateData.remindAt = input.remindAt;
  if (input.repeatMode !== undefined) updateData.repeatMode = input.repeatMode;
  if (input.notifyMethods !== undefined) updateData.notifyMethods = input.notifyMethods;

  const [updated] = await db.update(reminders)
    .set(updateData)
    .where(and(eq(reminders.id, id), eq(reminders.workspaceId, workspaceId)))
    .returning();

  return updated as ReminderData || null;
}

/**
 * 删除提醒
 */
export async function deleteReminder(id: string, workspaceId: string): Promise<boolean> {
  const result = await db.delete(reminders).where(
    and(eq(reminders.id, id), eq(reminders.workspaceId, workspaceId))
  ).returning();

  return result.length > 0;
}

/**
 * 标记提醒为已完成
 */
export async function completeReminder(id: string, workspaceId: string): Promise<ReminderData | null> {
  const [updated] = await db.update(reminders)
    .set({
      status: 'completed',
      updatedAt: new Date(),
    })
    .where(and(eq(reminders.id, id), eq(reminders.workspaceId, workspaceId)))
    .returning();

  // 如果是重复提醒，创建下一次提醒
  if (updated && updated.repeatMode !== 'once') {
    const nextRemindAt = calculateNextRemindAt(updated.remindAt, updated.repeatMode as RepeatMode);
    if (nextRemindAt) {
      await createReminder({
        content: updated.content,
        remindAt: nextRemindAt,
        repeatMode: updated.repeatMode as RepeatMode,
        notifyMethods: updated.notifyMethods as NotifyMethod[],
        workspaceId: updated.workspaceId,
      });
    }
  }

  return updated as ReminderData || null;
}

// ================================================================
// 列表查询
// ================================================================

/**
 * 获取提醒列表（按状态筛选）
 */
export async function listReminders(
  workspaceId: string,
  status?: ReminderStatus | 'all'
): Promise<ReminderData[]> {
  const conditions = [eq(reminders.workspaceId, workspaceId)];

  if (status && status !== 'all') {
    conditions.push(eq(reminders.status, status));
  }

  return db.select().from(reminders)
    .where(and(...conditions))
    .orderBy(desc(reminders.remindAt)) as Promise<ReminderData[]>;
}

/**
 * 获取分组提醒列表
 * 
 * 分组逻辑：
 * - 逾期：remindAt < now && status = 'pending'
 * - 今天：今天 00:00 ~ 23:59
 * - 明天：明天 00:00 ~ 23:59
 * - 本周：后天 ~ 周日
 * - 更晚：下周及以后
 */
export async function listRemindersGrouped(workspaceId: string): Promise<ReminderGroup[]> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowEnd = new Date(tomorrowStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  const weekEnd = new Date(todayStart.getTime() + (7 - now.getDay()) * 24 * 60 * 60 * 1000 - 1);

  // 查询所有待处理的提醒
  const allReminders = await db.select().from(reminders)
    .where(and(
      eq(reminders.workspaceId, workspaceId),
      eq(reminders.status, 'pending')
    ))
    .orderBy(reminders.remindAt) as ReminderData[];

  // 分组
  const groups: ReminderGroup[] = [];
  
  // 逾期
  const overdue = allReminders.filter(r => r.remindAt < now);
  if (overdue.length > 0) {
    groups.push({
      label: '逾期',
      key: 'overdue',
      reminders: overdue,
      isOverdue: true,
    });
  }

  // 今天
  const today = allReminders.filter(r => r.remindAt >= now && r.remindAt <= todayEnd);
  if (today.length > 0) {
    groups.push({
      label: '今天',
      key: 'today',
      reminders: today,
      isOverdue: false,
    });
  }

  // 明天
  const tomorrow = allReminders.filter(r => r.remindAt >= tomorrowStart && r.remindAt <= tomorrowEnd);
  if (tomorrow.length > 0) {
    groups.push({
      label: '明天',
      key: 'tomorrow',
      reminders: tomorrow,
      isOverdue: false,
    });
  }

  // 本周（后天到周日）
  const thisWeek = allReminders.filter(r => 
    r.remindAt > tomorrowEnd && r.remindAt <= weekEnd
  );
  if (thisWeek.length > 0) {
    groups.push({
      label: '本周',
      key: 'thisWeek',
      reminders: thisWeek,
      isOverdue: false,
    });
  }

  // 更晚
  const later = allReminders.filter(r => r.remindAt > weekEnd);
  if (later.length > 0) {
    groups.push({
      label: '更晚',
      key: 'later',
      reminders: later,
      isOverdue: false,
    });
  }

  return groups;
}

/**
 * 获取统计数据
 */
export async function getReminderStats(workspaceId: string): Promise<{
  pending: number;
  triggered: number;
  completed: number;
  overdue: number;
}> {
  const now = new Date();
  
  const [pending] = await db.select({ count: sql<number>`count(*)::int` })
    .from(reminders)
    .where(and(eq(reminders.workspaceId, workspaceId), eq(reminders.status, 'pending')));

  const [triggered] = await db.select({ count: sql<number>`count(*)::int` })
    .from(reminders)
    .where(and(eq(reminders.workspaceId, workspaceId), eq(reminders.status, 'triggered')));

  const [completed] = await db.select({ count: sql<number>`count(*)::int` })
    .from(reminders)
    .where(and(eq(reminders.workspaceId, workspaceId), eq(reminders.status, 'completed')));

  const [overdue] = await db.select({ count: sql<number>`count(*)::int` })
    .from(reminders)
    .where(and(
      eq(reminders.workspaceId, workspaceId),
      eq(reminders.status, 'pending'),
      lt(reminders.remindAt, now)
    ));

  return {
    pending: pending?.count || 0,
    triggered: triggered?.count || 0,
    completed: completed?.count || 0,
    overdue: overdue?.count || 0,
  };
}

// ================================================================
// 定时任务相关
// ================================================================

/**
 * 触发到期的提醒
 * 使用原子操作避免多实例重复触发
 */
export async function triggerDueReminders(): Promise<{
  triggered: number;
  reminders: ReminderData[];
}> {
  const now = new Date();

  // 原子操作：UPDATE + RETURNING
  const updated = await db.update(reminders)
    .set({
      status: 'triggered',
      remindedAt: now,
      updatedAt: now,
    })
    .where(and(
      eq(reminders.status, 'pending'),
      lte(reminders.remindAt, now)
    ))
    .returning();

  if (updated.length > 0) {
    console.log(`[reminders] 已触发 ${updated.length} 个提醒`);
  }

  return {
    triggered: updated.length,
    reminders: updated as ReminderData[],
  };
}

/**
 * 获取已触发的提醒（供前端轮询）
 */
export async function getTriggeredReminders(workspaceId: string): Promise<ReminderData[]> {
  return db.select().from(reminders)
    .where(and(
      eq(reminders.workspaceId, workspaceId),
      eq(reminders.status, 'triggered')
    ))
    .orderBy(reminders.remindAt) as Promise<ReminderData[]>;
}

// ================================================================
// 辅助函数
// ================================================================

/**
 * 计算下一次提醒时间
 */
function calculateNextRemindAt(currentRemindAt: Date, repeatMode: RepeatMode): Date | null {
  const next = new Date(currentRemindAt);
  
  switch (repeatMode) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      return next;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      return next;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      return next;
    default:
      return null;
  }
}
