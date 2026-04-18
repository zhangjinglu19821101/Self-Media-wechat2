/**
 * 通知服务 V2 - 支持去重和状态管理
 */

import { db } from '@/lib/db';
import { agentNotifications } from '@/lib/db/schema';
import { eq, and, gte, or } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export interface CreateNotificationParams {
  fromAgentId: string;
  toAgentId: string;
  notificationType: 'command' | 'result' | 'feedback' | 'system';
  title: string;
  content: any;
  relatedTaskId?: string;
  priority?: 'high' | 'normal' | 'low';
  metadata?: any;
}

/**
 * 创建通知（带去重检查）
 *
 * 去重规则：
 * - 相同的 fromAgentId + toAgentId + relatedTaskId
 * - 在 5 分钟内已经创建过相同类型的通知
 * - 则跳过创建
 */
export async function createNotificationWithDeduplication(
  params: CreateNotificationParams
): Promise<{ success: boolean; notificationId?: string; existing?: boolean; error?: string }> {
  try {
    const {
      fromAgentId,
      toAgentId,
      notificationType,
      title,
      content,
      relatedTaskId,
      priority = 'normal',
      metadata = {},
    } = params;

    // 🔥 去重检查：查找最近 5 分钟内是否存在相同的通知
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const existingNotifications = await db
      .select()
      .from(agentNotifications)
      .where(
        and(
          eq(agentNotifications.fromAgentId, fromAgentId),
          eq(agentNotifications.toAgentId, toAgentId),
          notificationType ? eq(agentNotifications.notificationType, notificationType) : undefined,
          relatedTaskId ? eq(agentNotifications.relatedTaskId, relatedTaskId) : undefined,
          gte(agentNotifications.createdAt, fiveMinutesAgo)
        )
      )
      .limit(1);

    // 🔥 如果存在相同的通知，返回 existing=true
    if (existingNotifications.length > 0) {
      console.log(`⚠️ 通知去重：跳过创建重复通知`, {
        fromAgentId,
        toAgentId,
        notificationType,
        relatedTaskId,
        existingNotificationId: existingNotifications[0].notificationId,
      });
      
      return {
        success: true,
        existing: true,
        notificationId: existingNotifications[0].notificationId,
      };
    }

    // 🔥 创建新通知
    const notificationId = `notif-${toAgentId}-${fromAgentId}-${Date.now()}-${randomUUID().slice(0, 8)}`;

    await db.insert(agentNotifications).values({
      notificationId,
      fromAgentId,
      toAgentId,
      notificationType,
      title,
      content: typeof content === 'object' ? JSON.stringify(content) : String(content),
      relatedTaskId,
      status: 'unread',
      priority,
      isRead: false,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`✅ 通知已创建: ${notificationId}`, {
      fromAgentId,
      toAgentId,
      notificationType,
      relatedTaskId,
    });

    return {
      success: true,
      existing: false,
      notificationId,
    };
  } catch (error) {
    console.error('❌ 创建通知失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 标记通知为已读
 */
export async function markNotificationAsRead(
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .update(agentNotifications)
      .set({
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentNotifications.notificationId, notificationId));

    console.log(`✅ 通知已标记为已读: ${notificationId}`);
    return { success: true };
  } catch (error) {
    console.error('❌ 标记通知为已读失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 标记所有通知为已读
 */
export async function markAllNotificationsAsRead(
  toAgentId: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const result = await db
      .update(agentNotifications)
      .set({
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(agentNotifications.toAgentId, toAgentId), eq(agentNotifications.isRead, false)))
      .returning();

    console.log(`✅ 已标记 ${result.length} 条通知为已读`);
    return { success: true, count: result.length };
  } catch (error) {
    console.error('❌ 标记所有通知为已读失败:', error);
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 清理旧通知（保留最近 30 天）
 */
export async function cleanupOldNotifications(
  daysToKeep: number = 30
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    const result = await db
      .delete(agentNotifications)
      .where(gte(agentNotifications.createdAt, cutoffDate))
      .returning();

    console.log(`✅ 已清理 ${result.length} 条旧通知`);
    return { success: true, count: result.length };
  } catch (error) {
    console.error('❌ 清理旧通知失败:', error);
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
