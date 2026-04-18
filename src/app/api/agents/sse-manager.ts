/**
 * SSE 连接管理器
 * 用于管理所有 Agent 的 SSE 连接
 */

import { db } from '@/lib/db';
import { agentNotifications } from '@/lib/db/schema';
import { randomUUID } from 'crypto';

// 🔥 存储所有 Agent 的 SSE 连接
const agentConnections = new Map<string, Set<ReadableStreamDefaultController>>();

/**
 * 发送通知到指定的 Agent
 * 同时将通知持久化到数据库
 */
export async function sendNotificationToAgent(
  agentId: string,
  notification: {
    type: 'task_result' | 'new_command' | 'system_notification';
    fromAgentId?: string;
    toAgentId?: string;
    taskId?: string;
    result?: string;
    status?: string;
    timestamp?: string;
    message?: string;
  }
) {
  // 1. 持久化通知到数据库
  try {
    const notificationId = `notif_${randomUUID()}`;
    const now = new Date();

    // 映射通知类型到数据库类型
    let notificationType = 'system';
    let title = '';
    let content = '';

    if (notification.type === 'new_command') {
      notificationType = 'command';
      title = `来自 Agent ${notification.fromAgentId} 的新指令`;
      content = JSON.stringify({
        taskId: notification.taskId,
        fromAgentId: notification.fromAgentId,
        toAgentId: notification.toAgentId,
        timestamp: notification.timestamp || now.toISOString(),
      });
    } else if (notification.type === 'task_result') {
      notificationType = 'result';
      title = `Agent ${notification.fromAgentId} 的任务执行结果`;
      content = JSON.stringify({
        taskId: notification.taskId,
        fromAgentId: notification.fromAgentId,
        toAgentId: notification.toAgentId,
        result: notification.result,
        status: notification.status,
        timestamp: notification.timestamp || now.toISOString(),
      });
    } else {
      title = '系统通知';
      content = JSON.stringify(notification);
    }

    await db.insert(agentNotifications).values({
      notificationId,
      fromAgentId: notification.fromAgentId || 'system',
      toAgentId: agentId,
      notificationType,
      title,
      content,
      relatedTaskId: notification.taskId,
      status: 'unread',
      priority: 'normal',
      isRead: false,
      createdAt: now,
    });

    console.log(`✅ 通知已持久化到数据库: ${notificationId}`);
  } catch (error) {
    console.error('❌ 持久化通知到数据库失败:', error);
    // 不影响 SSE 推送，继续执行
  }

  // 2. 通过 SSE 推送通知
  const connections = agentConnections.get(agentId);
  if (!connections) {
    console.log(`⚠️  Agent ${agentId} 没有 SSE 连接`);
    return;
  }

  const message = `data: ${JSON.stringify(notification)}\n\n`;

  connections.forEach(controller => {
    try {
      controller.enqueue(new TextEncoder().encode(message));
    } catch (error) {
      console.error(`Error sending notification to Agent ${agentId}:`, error);
    }
  });

  console.log(`✅ 已向 Agent ${agentId} 推送通知: ${notification.type}`);
}

/**
 * 获取 Agent 的连接集合
 */
export function getAgentConnections(agentId: string): Set<ReadableStreamDefaultController> | undefined {
  return agentConnections.get(agentId);
}

/**
 * 添加 Agent 连接
 */
export function addAgentConnection(agentId: string, controller: ReadableStreamDefaultController): void {
  if (!agentConnections.has(agentId)) {
    agentConnections.set(agentId, new Set());
  }
  agentConnections.get(agentId)!.add(controller);
}

/**
 * 移除 Agent 连接
 */
export function removeAgentConnection(agentId: string, controller: ReadableStreamDefaultController): void {
  const connections = agentConnections.get(agentId);
  if (connections) {
    connections.delete(controller);
    if (connections.size === 0) {
      agentConnections.delete(agentId);
    }
  }
}

/**
 * 获取所有 Agent 连接（仅用于调试）
 */
export function getAllAgentConnections(): Map<string, Set<ReadableStreamDefaultController>> {
  return new Map(agentConnections);
}
