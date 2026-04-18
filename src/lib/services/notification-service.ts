/**
 * Agent 通知服务
 * 管理 Agent 间通信通知（指令、任务结果、反馈、系统通知）
 */

import { db } from '@/lib/db';
import { agentNotifications } from '@/lib/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { sendNotificationToAgent } from '@/app/api/agents/sse-manager';

/**
 * 通知类型
 */
export enum NotificationType {
  COMMAND = 'command', // 指令通知
  RESULT = 'result', // 任务结果通知
  FEEDBACK = 'feedback', // 反馈通知
  SYSTEM = 'system', // 系统通知
  SUBTASK_ASSIGNED = 'subtask_assigned', // 子任务分配通知
  SUBTASK_ESCALATED = 'subtask_escalated', // 子任务上报通知
  TASK_CONFIRMATION = 'task_confirmation', // 任务确认通知
  TIMEOUT_ALERT = 'timeout_alert', // 超时告警通知
}

/**
 * 通知优先级
 */
export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * 通知状态
 */
export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
  PROCESSED = 'processed',
}

/**
 * 创建通知的参数
 */
export interface CreateNotificationParams {
  agentId: string; // 接收方 Agent ID
  type: NotificationType | string; // 通知类型
  title: string; // 通知标题
  content: any; // 通知内容（可以是对象，会被序列化为 JSON）
  relatedTaskId?: string; // 关联的任务ID
  fromAgentId?: string; // 发送方 Agent ID（可选，默认为 'system'）
  priority?: NotificationPriority | string; // 优先级（可选，默认为 'normal'）
  metadata?: Record<string, any>; // 额外元数据
  result?: string; // 任务执行结果（可选，会保存到 content.result 中）
}

/**
 * 创建通知
 */
export async function createNotification(params: CreateNotificationParams): Promise<string> {
  const {
    agentId,
    type,
    title,
    content,
    relatedTaskId,
    fromAgentId = 'system',
    priority = NotificationPriority.NORMAL,
    metadata = {},
    result,
  } = params;

  const notificationId = `notification-${randomUUID()}`;
  
  // 🔥 如果提供了 result，将其添加到 content 中
  const contentWithResult = typeof content === 'object' && content !== null 
    ? { ...content, ...(result !== undefined ? { result } : {}) }
    : content;
  
  const contentJson = typeof contentWithResult === 'string' 
    ? contentWithResult 
    : JSON.stringify(contentWithResult);

  const [notification] = await db
    .insert(agentNotifications)
    .values({
      notificationId,
      fromAgentId,
      toAgentId: agentId,
      notificationType: type,
      title,
      content: contentJson,
      relatedTaskId,
      priority,
      metadata,
      status: NotificationStatus.UNREAD,
      isRead: false,
    })
    .returning({ id: agentNotifications.id });

  console.log(`✅ 通知已创建: ${type} -> ${agentId} (${notificationId})`);

  // 🔥 同时通过 SSE 实时推送给目标 Agent
  try {
    await sendNotificationToAgent(agentId, {
      type: type === 'command' ? 'new_command' : 
            type === 'result' ? 'task_result' : 
            type === 'agent_b_split_result' ? 'task_result' : // 🔥 agent_b_split_result 映射为 task_result
            'system_notification',
      fromAgentId,
      toAgentId: agentId,
      taskId: relatedTaskId,
      result: params.result, // 🔥 使用 params.result
      timestamp: new Date().toISOString(),
      message: title,
    });
    console.log(`✅ 通知已通过 SSE 推送给 Agent ${agentId}`);
  } catch (error) {
    console.error(`❌ SSE 推送通知失败:`, error);
    // SSE 推送失败不影响数据库记录，继续执行
  }

  return notificationId;
}

/**
 * 获取未读通知
 */
export async function getUnreadNotifications(agentId: string, limit: number = 10) {
  const notifications = await db
    .select()
    .from(agentNotifications)
    .where(
      and(
        eq(agentNotifications.toAgentId, agentId),
        eq(agentNotifications.isRead, false)
      )
    )
    .orderBy(desc(agentNotifications.createdAt))
    .limit(limit);

  // 解析 content JSON
  return notifications.map(notification => ({
    ...notification,
    content: JSON.parse(notification.content),
  }));
}

/**
 * 标记通知为已读
 */
export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  const result = await db
    .update(agentNotifications)
    .set({
      isRead: true,
      status: NotificationStatus.READ,
      readAt: new Date(),
    })
    .where(eq(agentNotifications.notificationId, notificationId))
    .returning({ id: agentNotifications.id });

  return result.length > 0;
}

/**
 * 标记通知为未读（重置 isRead 状态）
 */
export async function markNotificationAsUnread(notificationId: string): Promise<boolean> {
  const result = await db
    .update(agentNotifications)
    .set({
      isRead: false,
      status: NotificationStatus.UNREAD,
      readAt: null,
    })
    .where(eq(agentNotifications.notificationId, notificationId))
    .returning({ id: agentNotifications.id });

  return result.length > 0;
}

/**
 * 标记通知为已处理
 */
export async function markNotificationAsProcessed(notificationId: string): Promise<boolean> {
  const result = await db
    .update(agentNotifications)
    .set({
      status: NotificationStatus.PROCESSED,
      readAt: new Date(),
    })
    .where(eq(agentNotifications.notificationId, notificationId))
    .returning({ id: agentNotifications.id });

  return result.length > 0;
}

/**
 * 批量标记 Agent 的通知为已读
 */
export async function markAllNotificationsAsRead(agentId: string): Promise<number> {
  const result = await db
    .update(agentNotifications)
    .set({
      isRead: true,
      status: NotificationStatus.READ,
      readAt: new Date(),
    })
    .where(
      and(
        eq(agentNotifications.toAgentId, agentId),
        eq(agentNotifications.isRead, false)
      )
    )
    .returning({ id: agentNotifications.id });

  return result.length;
}

/**
 * 获取通知统计
 */
export async function getNotificationStats(agentId: string) {
  const stats = await db
    .select({
      total: sql<number>`COUNT(*)`,
      unread: sql<number>`COUNT(*) FILTER (WHERE is_read = false)`,
      highPriority: sql<number>`COUNT(*) FILTER (WHERE priority = 'high' OR priority = 'urgent')`,
    })
    .from(agentNotifications)
    .where(eq(agentNotifications.toAgentId, agentId));

  return stats[0] || { total: 0, unread: 0, highPriority: 0 };
}

/**
 * 删除通知
 */
export async function deleteNotification(notificationId: string): Promise<boolean> {
  const result = await db
    .delete(agentNotifications)
    .where(eq(agentNotifications.notificationId, notificationId))
    .returning({ id: agentNotifications.id });

  return result.length > 0;
}

/**
 * 获取通知历史
 */
export async function getNotificationHistory(agentId: string, limit: number = 50) {
  const notifications = await db
    .select()
    .from(agentNotifications)
    .where(eq(agentNotifications.toAgentId, agentId))
    .orderBy(desc(agentNotifications.createdAt))
    .limit(limit);

  // 解析 content JSON
  return notifications.map(notification => ({
    ...notification,
    content: JSON.parse(notification.content),
  }));
}

/**
 * 清理旧通知
 */
export async function cleanupOldNotifications(daysToKeep: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = await db
    .delete(agentNotifications)
    .where(sql`${agentNotifications.createdAt} < ${cutoffDate}`)
    .returning({ id: agentNotifications.id });

  console.log(`✅ 已清理 ${result.length} 条旧通知`);

  return result.length;
}
