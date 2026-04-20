/**
 * 提醒服务层
 * 
 * 核心概念：谁要求谁做什么事情
 * 双视角：出向（我要求别人）/ 入向（别人要求我）
 */

import { db } from '@/lib/db';
import {
  reminders,
  type ReminderStatus,
  type RepeatMode,
  type NotifyMethod,
  type Direction,
} from '@/lib/db/schema/reminders';
import { eq, and, desc, lte, lt, sql, or, ilike } from 'drizzle-orm';

// ================================================================
// 类型定义
// ================================================================

export interface ReminderData {
  id: string;
  requesterName: string;
  assigneeName: string;
  content: string;
  direction: Direction;
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
  requesterName: string;
  assigneeName: string;
  content: string;
  direction?: Direction;
  remindAt: Date;
  repeatMode?: RepeatMode;
  notifyMethods?: NotifyMethod[];
  workspaceId: string;
}

export interface UpdateReminderInput {
  requesterName?: string;
  assigneeName?: string;
  content?: string;
  remindAt?: Date;
  repeatMode?: RepeatMode;
  notifyMethods?: NotifyMethod[];
}

export interface ReminderGroup {
  label: string;
  key: string;
  reminders: ReminderData[];
  isOverdue: boolean;
}

export interface ListOptions {
  direction?: Direction;
  status?: ReminderStatus | 'all';
  keyword?: string;
  personName?: string;
  page?: number;
  pageSize?: number;
}

export interface PersonSummary {
  name: string;
  outboundCount: number;   // 我要求此人的数量
  inboundCount: number;    // 此人要求我的数量
  overdueCount: number;    // 逾期数量
}

// ================================================================
// CRUD 操作
// ================================================================

/**
 * 创建提醒
 */
export async function createReminder(input: CreateReminderInput): Promise<ReminderData> {
  const [reminder] = await db.insert(reminders).values({
    requesterName: input.requesterName,
    assigneeName: input.assigneeName,
    content: input.content,
    direction: input.direction || 'outbound',
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
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.requesterName !== undefined) updateData.requesterName = input.requesterName;
  if (input.assigneeName !== undefined) updateData.assigneeName = input.assigneeName;
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

  // 重复提醒：创建下一次
  if (updated && updated.repeatMode !== 'once') {
    const nextRemindAt = calculateNextRemindAt(updated.remindAt, updated.repeatMode as RepeatMode);
    if (nextRemindAt) {
      await createReminder({
        requesterName: updated.requesterName,
        assigneeName: updated.assigneeName,
        content: updated.content,
        direction: updated.direction as Direction,
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
// 列表查询（支持检索条件）
// ================================================================

/**
 * 获取提醒列表（支持方向/状态/关键词/人名筛选）
 */
export async function listReminders(
  workspaceId: string,
  options: ListOptions = {}
): Promise<{ data: ReminderData[]; total: number }> {
  const {
    direction,
    status = 'all',
    keyword,
    personName,
    page = 1,
    pageSize = 50,
  } = options;

  const conditions = [eq(reminders.workspaceId, workspaceId)];

  if (direction) {
    conditions.push(eq(reminders.direction, direction));
  }

  if (status && status !== 'all') {
    conditions.push(eq(reminders.status, status));
  }

  if (keyword) {
    conditions.push(ilike(reminders.content, `%${keyword}%`));
  }

  if (personName) {
    conditions.push(
      or(
        ilike(reminders.requesterName, `%${personName}%`),
        ilike(reminders.assigneeName, `%${personName}%`)
      )!
    );
  }

  const whereClause = and(...conditions);

  // 查总数
  const [countResult] = await db.select({ count: sql<number>`count(*)::int` })
    .from(reminders)
    .where(whereClause);

  // 查数据
  const data = await db.select().from(reminders)
    .where(whereClause)
    .orderBy(reminders.remindAt)
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    data: data as ReminderData[],
    total: countResult?.count || 0,
  };
}

/**
 * 获取分组提醒列表（按时间分组，支持方向筛选）
 */
export async function listRemindersGrouped(
  workspaceId: string,
  direction?: Direction
): Promise<ReminderGroup[]> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowEnd = new Date(tomorrowStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  const weekEnd = new Date(todayStart.getTime() + (7 - now.getDay()) * 24 * 60 * 60 * 1000 - 1);

  const conditions = [eq(reminders.workspaceId, workspaceId), eq(reminders.status, 'pending')];
  if (direction) {
    conditions.push(eq(reminders.direction, direction));
  }

  const allReminders = await db.select().from(reminders)
    .where(and(...conditions))
    .orderBy(reminders.remindAt) as ReminderData[];

  const groups: ReminderGroup[] = [];

  // 逾期
  const overdue = allReminders.filter(r => r.remindAt < now);
  if (overdue.length > 0) {
    groups.push({ label: '逾期', key: 'overdue', reminders: overdue, isOverdue: true });
  }

  // 今天
  const today = allReminders.filter(r => r.remindAt >= now && r.remindAt <= todayEnd);
  if (today.length > 0) {
    groups.push({ label: '今天', key: 'today', reminders: today, isOverdue: false });
  }

  // 明天
  const tomorrow = allReminders.filter(r => r.remindAt >= tomorrowStart && r.remindAt <= tomorrowEnd);
  if (tomorrow.length > 0) {
    groups.push({ label: '明天', key: 'tomorrow', reminders: tomorrow, isOverdue: false });
  }

  // 本周
  const thisWeek = allReminders.filter(r => r.remindAt > tomorrowEnd && r.remindAt <= weekEnd);
  if (thisWeek.length > 0) {
    groups.push({ label: '本周', key: 'thisWeek', reminders: thisWeek, isOverdue: false });
  }

  // 更晚
  const later = allReminders.filter(r => r.remindAt > weekEnd);
  if (later.length > 0) {
    groups.push({ label: '更晚', key: 'later', reminders: later, isOverdue: false });
  }

  return groups;
}

// ================================================================
// 人物摘要（用于快速检索）
// ================================================================

/**
 * 获取人物摘要列表
 * 返回所有相关人物及其出向/入向/逾期数量
 */
export async function getPersonSummaries(workspaceId: string): Promise<PersonSummary[]> {
  // 查询所有相关人名
  const nameRows = await db.selectDistinct({
    name: sql<string>`
      CASE 
        WHEN ${reminders.direction} = 'outbound' THEN ${reminders.assigneeName}
        WHEN ${reminders.direction} = 'inbound' THEN ${reminders.requesterName}
      END
    `.as('name'),
  }).from(reminders)
    .where(eq(reminders.workspaceId, workspaceId));

  const names = [...new Set(nameRows.map(r => r.name).filter(Boolean))];

  // 逐人统计
  const summaries: PersonSummary[] = [];
  for (const name of names) {
    // 出向：我要求此人（assigneeName = name 且 direction = outbound）
    const [outbound] = await db.select({ count: sql<number>`count(*)::int` })
      .from(reminders)
      .where(and(
        eq(reminders.workspaceId, workspaceId),
        eq(reminders.assigneeName, name),
        eq(reminders.direction, 'outbound')
      ));

    // 入向：此人要求我（requesterName = name 且 direction = inbound）
    const [inbound] = await db.select({ count: sql<number>`count(*)::int` })
      .from(reminders)
      .where(and(
        eq(reminders.workspaceId, workspaceId),
        eq(reminders.requesterName, name),
        eq(reminders.direction, 'inbound')
      ));

    // 逾期（此人相关且已逾期）
    const now = new Date();
    const [overdue] = await db.select({ count: sql<number>`count(*)::int` })
      .from(reminders)
      .where(and(
        eq(reminders.workspaceId, workspaceId),
        eq(reminders.status, 'pending'),
        lt(reminders.remindAt, now),
        or(
          and(eq(reminders.assigneeName, name), eq(reminders.direction, 'outbound')),
          and(eq(reminders.requesterName, name), eq(reminders.direction, 'inbound'))
        )
      ));

    summaries.push({
      name,
      outboundCount: outbound?.count || 0,
      inboundCount: inbound?.count || 0,
      overdueCount: overdue?.count || 0,
    });
  }

  // 按逾期数 + 总数排序
  return summaries.sort((a, b) => {
    const aTotal = a.overdueCount * 100 + a.outboundCount + a.inboundCount;
    const bTotal = b.overdueCount * 100 + b.outboundCount + b.inboundCount;
    return bTotal - aTotal;
  });
}

// ================================================================
// 统计数据
// ================================================================

/**
 * 获取统计数据（按方向分组）
 */
export async function getReminderStats(workspaceId: string): Promise<{
  outbound: { pending: number; overdue: number; completed: number };
  inbound: { pending: number; overdue: number; completed: number };
  total: { pending: number; triggered: number; completed: number; overdue: number };
}> {
  const now = new Date();

  // 出向统计
  const [outPending] = await db.select({ count: sql<number>`count(*)::int` })
    .from(reminders).where(and(eq(reminders.workspaceId, workspaceId), eq(reminders.direction, 'outbound'), eq(reminders.status, 'pending')));
  const [outOverdue] = await db.select({ count: sql<number>`count(*)::int` })
    .from(reminders).where(and(eq(reminders.workspaceId, workspaceId), eq(reminders.direction, 'outbound'), eq(reminders.status, 'pending'), lt(reminders.remindAt, now)));
  const [outCompleted] = await db.select({ count: sql<number>`count(*)::int` })
    .from(reminders).where(and(eq(reminders.workspaceId, workspaceId), eq(reminders.direction, 'outbound'), eq(reminders.status, 'completed')));

  // 入向统计
  const [inPending] = await db.select({ count: sql<number>`count(*)::int` })
    .from(reminders).where(and(eq(reminders.workspaceId, workspaceId), eq(reminders.direction, 'inbound'), eq(reminders.status, 'pending')));
  const [inOverdue] = await db.select({ count: sql<number>`count(*)::int` })
    .from(reminders).where(and(eq(reminders.workspaceId, workspaceId), eq(reminders.direction, 'inbound'), eq(reminders.status, 'pending'), lt(reminders.remindAt, now)));
  const [inCompleted] = await db.select({ count: sql<number>`count(*)::int` })
    .from(reminders).where(and(eq(reminders.workspaceId, workspaceId), eq(reminders.direction, 'inbound'), eq(reminders.status, 'completed')));

  // 总计
  const [totalPending] = await db.select({ count: sql<number>`count(*)::int` })
    .from(reminders).where(and(eq(reminders.workspaceId, workspaceId), eq(reminders.status, 'pending')));
  const [totalTriggered] = await db.select({ count: sql<number>`count(*)::int` })
    .from(reminders).where(and(eq(reminders.workspaceId, workspaceId), eq(reminders.status, 'triggered')));
  const [totalCompleted] = await db.select({ count: sql<number>`count(*)::int` })
    .from(reminders).where(and(eq(reminders.workspaceId, workspaceId), eq(reminders.status, 'completed')));
  const [totalOverdue] = await db.select({ count: sql<number>`count(*)::int` })
    .from(reminders).where(and(eq(reminders.workspaceId, workspaceId), eq(reminders.status, 'pending'), lt(reminders.remindAt, now)));

  return {
    outbound: { pending: outPending?.count || 0, overdue: outOverdue?.count || 0, completed: outCompleted?.count || 0 },
    inbound: { pending: inPending?.count || 0, overdue: inOverdue?.count || 0, completed: inCompleted?.count || 0 },
    total: {
      pending: totalPending?.count || 0,
      triggered: totalTriggered?.count || 0,
      completed: totalCompleted?.count || 0,
      overdue: totalOverdue?.count || 0,
    },
  };
}

// ================================================================
// 定时任务相关
// ================================================================

/**
 * 触发到期的提醒（原子操作）
 */
export async function triggerDueReminders(): Promise<{
  triggered: number;
  reminders: ReminderData[];
}> {
  const now = new Date();

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
 * 获取已触发的提醒
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
