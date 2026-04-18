/**
 * Agent 通知服务 v3（带去重机制）
 * 管理 Agent 间通信通知（指令、任务结果、反馈、系统通知）
 *
 * 🔥 新增功能：通知去重机制
 */

import { db } from '@/lib/db';
import { agentNotifications } from '@/lib/db/schema';
import { eq, desc, and, sql, gt } from 'drizzle-orm';
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
  INSURANCE_D_SPLIT_RESULT = 'insurance_d_split_result', // insurance-d 拆解结果通知
  AGENT_B_SPLIT_RESULT = 'agent_b_split_result', // Agent B 拆解结果通知
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
  dedupWindowMinutes?: number; // 去重时间窗口（分钟），默认 10 分钟
}

/**
 * 🔥 创建通知（带去重机制）
 *
 * 去重规则：
 * 1. 相同 type + relatedTaskId + toAgentId 的通知
 * 2. 在指定时间窗口内（默认 10 分钟）
 * 3. 通知内容相似（包含相同的 taskId 或 dailyTaskIds）
 *
 * @param params 通知参数
 * @returns 通知 ID（如果已存在则返回现有通知 ID）
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
    dedupWindowMinutes = 10, // 🔥 默认 10 分钟去重窗口
  } = params;

  // 🔥 检查是否需要去重（duplicate_task_warning 类型不被去重）
  if (relatedTaskId && type !== 'duplicate_task_warning') { // 🔥 跳过重复任务警告的去重
    const dedupResult = await deduplicateNotification({
      agentId,
      type,
      relatedTaskId,
      dedupWindowMinutes,
    });

    if (dedupResult.isDuplicate) {
      console.log(`⚠️ [通知去重] 发现重复通知，跳过创建`);
      console.log(`  - 通知类型: ${type}`);
      console.log(`  - 关联任务: ${relatedTaskId}`);
      console.log(`  - 现有通知: ${dedupResult.existingNotificationId}`);
      console.log(`  - 创建时间: ${dedupResult.existingCreatedAt}`);
      return dedupResult.existingNotificationId; // 🔥 返回现有通知 ID
    }
  }

  // 🔥 duplicate_task_warning 类型通知：每次都创建新通知，不被去重
  if (type === 'duplicate_task_warning') {
    console.log(`🔔 [重复任务警告] 创建新通知（不被去重）`);
  }

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
      status: 'unread',
      isRead: false,
    })
    .returning({ id: agentNotifications.id });

  console.log(`✅ 通知已创建: ${type} -> ${agentId} (${notificationId})`);

  // 🔥 同时通过 SSE 实时推送给目标 Agent
  try {
    await sendNotificationToAgent(agentId, {
      type: type === 'command' ? 'new_command' :
            type === 'result' ? 'task_result' :
            type === 'insurance_d_split_result' ? 'insurance_d_split_result' :
            type === 'agent_b_split_result' ? 'agent_b_split_result' :
            type === 'duplicate_task_warning' ? 'duplicate_task_warning' : // 🔥 新增重复任务警告
            'system_notification',
      fromAgentId,
      toAgentId: agentId,
      taskId: relatedTaskId,
      result: params.result,
      timestamp: new Date().toISOString(),
      message: title,
      metadata: metadata, // 🔥 传递 metadata 给前端
    });
    console.log(`✅ 通知已通过 SSE 推送给 Agent ${agentId}`);
  } catch (error) {
    console.error(`❌ SSE 推送通知失败:`, error);
    // SSE 推送失败不影响数据库记录，继续执行
  }

  return notificationId;
}

/**
 * 🔥 通知去重检查
 *
 * 去重规则（去掉10分钟窗口，改为终态判断）：
 * 1. 相同 type + relatedTaskId + toAgentId 的通知
 * 2. 如果是拆解相关通知：
 *    - 如果旧通知是终态（rejected / confirmed / skipped）→ 创建新通知
 *    - 如果旧通知是中间态（popup_shown / null）→ 更新为 expired，然后创建新通知
 * 3. 非拆解通知：保持原有去重逻辑（向后兼容）
 *
 * @param params 去重参数
 * @returns 去重结果
 */
async function deduplicateNotification(params: {
  agentId: string;
  type: string;
  relatedTaskId: string;
  dedupWindowMinutes: number;
}) {
  const { agentId, type, relatedTaskId, dedupWindowMinutes } = params;

  // 🔥 查询所有匹配的通知（去掉10分钟窗口限制）
  const existingNotifications = await db
    .select()
    .from(agentNotifications)
    .where(
      and(
        eq(agentNotifications.toAgentId, agentId),
        eq(agentNotifications.notificationType, type),
        eq(agentNotifications.relatedTaskId, relatedTaskId)
      )
    )
    .orderBy(desc(agentNotifications.createdAt))
    .limit(1);

  if (existingNotifications.length > 0) {
    const existing = existingNotifications[0];
    const isSplitNotification = type.includes('split');
    
    console.log(`🔍 [通知去重] 找到现有通知: ${existing.notificationId}`);
    console.log(`  - 通知类型: ${type}`);
    console.log(`  - 是否拆解通知: ${isSplitNotification}`);
    console.log(`  - 旧通知状态: ${existing.metadata?.splitPopupStatus}`);

    if (isSplitNotification) {
      // 🔥 拆解通知：按终态逻辑处理
      const splitPopupStatus = existing.metadata?.splitPopupStatus;
      const isFinalState = ['rejected', 'confirmed', 'skipped'].includes(splitPopupStatus);
      const isIntermediateState = ['popup_shown', null, undefined].includes(splitPopupStatus);

      console.log(`  - 是否终态: ${isFinalState}`);
      console.log(`  - 是否中间态: ${isIntermediateState}`);

      if (isFinalState) {
        // 🔥 终态：直接创建新通知
        console.log(`⚠️ [通知去重] 旧通知是终态（${splitPopupStatus}），创建新通知`);
        // 继续创建新通知，不返回现有通知 ID
      } else if (isIntermediateState) {
        // 🔥 中间态：更新旧通知为 expired，然后创建新通知
        console.log(`⚠️ [通知去重] 旧通知是中间态（${splitPopupStatus}），更新为 expired 后创建新通知`);
        try {
          await db
            .update(agentNotifications)
            .set({
              metadata: {
                ...existing.metadata,
                splitPopupStatus: 'expired',
                expiredAt: new Date().toISOString(),
              },
            })
            .where(eq(agentNotifications.notificationId, existing.notificationId));
          console.log(`✅ [通知去重] 旧通知已更新为 expired: ${existing.notificationId}`);
        } catch (error) {
          console.error(`❌ [通知去重] 更新旧通知为 expired 失败:`, error);
        }
        // 继续创建新通知
      } else {
        // 🔥 其他状态（如 expired）：直接创建新通知
        console.log(`⚠️ [通知去重] 旧通知状态为 ${splitPopupStatus}，创建新通知`);
        // 继续创建新通知
      }
    } else {
      // 🔥 非拆解通知：保持原有去重逻辑（向后兼容）
      // 检查是否在10分钟窗口内
      const now = Date.now();
      const cutoffTime = new Date(now - dedupWindowMinutes * 60 * 1000);
      const isWithinWindow = new Date(existing.createdAt) > cutoffTime;

      if (isWithinWindow) {
        console.log(`⚠️ [通知去重] 发现重复通知（非拆解类型），跳过创建`);
        return {
          isDuplicate: true,
          existingNotificationId: existing.notificationId,
          existingCreatedAt: existing.createdAt,
        };
      } else {
        console.log(`⚠️ [通知去重] 旧通知超出时间窗口，创建新通知`);
        // 继续创建新通知
      }
    }
  }

  return {
    isDuplicate: false,
    existingNotificationId: null,
    existingCreatedAt: null,
  };
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
export async function markNotificationAsRead(notificationId: string) {
  await db
    .update(agentNotifications)
    .set({ isRead: true, readAt: new Date() })
    .where(eq(agentNotifications.notificationId, notificationId));
}

/**
 * 批量标记通知为已读
 */
export async function markNotificationsAsRead(agentId: string) {
  await db
    .update(agentNotifications)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(agentNotifications.toAgentId, agentId),
        eq(agentNotifications.isRead, false)
      )
    );
}

/**
 * 清理过期通知
 */
export async function cleanupExpiredNotifications(daysToKeep: number = 30) {
  await db
    .delete(agentNotifications)
    .where(
      sql`${agentNotifications.createdAt} < NOW() - INTERVAL '${daysToKeep} days'`
    );
}
