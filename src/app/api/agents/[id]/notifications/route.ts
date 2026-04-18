/**
 * GET /api/agents/[agentId]/notifications
 * 获取Agent的最新通知（任务结果、新指令等）
 *
 * POST /api/agents/[agentId]/notifications
 * 创建新的通知（任务结果、指令等）
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { agentNotifications } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { id: agentId } = await params;
    const { searchParams } = new URL(request.url);
    const includeRead = searchParams.get('includeRead') === 'true';

    // 🔥 修改：根据参数决定是否包含已读通知
    // 如果 includeRead=true，返回最近 20 条通知（包括已读）
    // 否则，只返回未读的通知
    const whereConditions = [eq(agentNotifications.toAgentId, agentId)];
    if (!includeRead) {
      whereConditions.push(eq(agentNotifications.isRead, false));
    }

    const dbNotifications = await db
      .select()
      .from(agentNotifications)
      .where(and(...whereConditions))
      .orderBy(desc(agentNotifications.createdAt))
      .limit(includeRead ? 20 : 50);

    // 转换为前端需要的格式
    const notifications = dbNotifications.map(notif => {
      let content;
      try {
        content = JSON.parse(notif.content);
      } catch (error) {
        // 如果 content 不是 JSON 格式，直接使用原字符串
        content = notif.content;
      }

      if (notif.notificationType === 'command') {
        return {
          type: 'new_command',
          fromAgentId: content.fromAgentId,
          toAgentId: content.toAgentId,
          taskId: notif.relatedTaskId,
          timestamp: notif.createdAt,
          notificationId: notif.notificationId,
          isRead: notif.isRead, // 🔥 添加 isRead 字段
          content: content, // 🔥 添加 content 字段
          metadata: notif.metadata, // 🔥 添加 metadata 字段
        };
      } else if (notif.notificationType === 'result') {
        return {
          type: 'task_result',
          fromAgentId: content.fromAgentId,
          toAgentId: content.toAgentId,
          taskId: notif.relatedTaskId,
          result: content.result,
          status: content.status,
          timestamp: notif.createdAt,
          notificationId: notif.notificationId,
          isRead: notif.isRead, // 🔥 添加 isRead 字段
          content: content, // 🔥 添加 content 字段（用于 insurance_d_split_result）
          metadata: notif.metadata, // 🔥 添加 metadata 字段
        };
      } else if (notif.notificationType === 'insurance_d_split_result') {
        // 🔥 新增：处理 insurance-d 拆解结果通知
        return {
          type: notif.notificationType,
          fromAgentId: content.fromAgentId || 'insurance-d', // 🔥 修复：添加顶层 fromAgentId 字段
          toAgentId: content.toAgentId || 'A', // 🔥 修复：添加顶层 toAgentId 字段
          taskId: notif.relatedTaskId,
          relatedTaskId: notif.relatedTaskId,
          content: content,
          metadata: notif.metadata,
          timestamp: notif.createdAt,
          notificationId: notif.notificationId,
          isRead: notif.isRead,
        };
      } else if (notif.notificationType === 'agent_b_split_result') {
        // 🔥 新增：处理 Agent B 拆解结果通知
        // 解析 result 字段（可能包含拆解结果）
        let result = content.result;
        try {
          if (typeof result === 'string') {
            result = JSON.parse(result);
          }
        } catch (e) {
          console.log('⚠️ 解析 Agent B 拆解结果失败:', e);
        }
        
        return {
          type: 'agent_b_split_result', // 🔥 保持原始类型，让前端能够正确判断
          notification_type: 'agent_b_split_result', // 🔥 明确设置 notification_type 字段
          fromAgentId: content.fromAgentId || 'B',
          toAgentId: content.toAgentId || 'A',
          taskId: notif.relatedTaskId,
          result: result,
          status: 'completed',
          timestamp: notif.createdAt,
          notificationId: notif.notificationId,
          isRead: notif.isRead,
          content: content,
          metadata: notif.metadata,
        };
      } else if (notif.notificationType === 'duplicate_task_warning') {
        // 🔥 新增：处理重复任务警告通知
        return {
          type: 'duplicate_task_warning',
          fromAgentId: content.fromAgentId || 'system',
          toAgentId: content.toAgentId || agentId,
          title: notif.title,
          content: content,
          taskId: notif.relatedTaskId,
          metadata: notif.metadata,
          timestamp: notif.createdAt,
          notificationId: notif.notificationId,
          isRead: notif.isRead,
        };
      } else {
        return {
          type: 'system_notification',
          message: content.message || notif.title,
          timestamp: notif.createdAt,
          notificationId: notif.notificationId,
          isRead: notif.isRead, // 🔥 添加 isRead 字段
          content: content, // 🔥 添加 content 字段
          metadata: notif.metadata, // 🔥 添加 metadata 字段
        };
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        count: notifications.length,
        latestTimestamp: notifications.length > 0
          ? new Date(notifications[0].timestamp).getTime()
          : 0,
      },
    });
  } catch (error) {
    console.error('Error fetching agent notifications:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取通知失败',
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { id: agentId } = await params;
    const body = await request.json();

    const {
      type, // 'task_result' | 'command' | 'system_notification'
      fromAgentId,
      toAgentId,
      taskId,
      result,
      status,
      message,
      timestamp,
      data,
    } = body;

    // 生成通知 ID
    const notificationId = `notif-${agentId}-${fromAgentId}-${Date.now()}`;

    // 构建通知内容（JSON 格式）
    let content: any = {
      fromAgentId,
      toAgentId,
    };

    if (type === 'task_result') {
      content = {
        ...content,
        result,
        status,
        data,
      };
    } else if (type === 'command') {
      content = {
        ...content,
        command: body.command,
        commandType: body.commandType,
        priority: body.priority,
      };
    } else if (type === 'system_notification') {
      content = {
        ...content,
        message,
      };
    }

    // 确定通知类型（映射到数据库的 notificationType）
    const notificationTypeMap: Record<string, 'command' | 'result' | 'feedback' | 'system'> = {
      task_result: 'result',
      new_command: 'command',
      command: 'command',
      system_notification: 'system',
    };

    const dbNotificationType = notificationTypeMap[type] || 'system';

    // 生成通知标题
    let title = '系统通知';
    if (type === 'task_result') {
      title = `任务完成：${fromAgentId} → ${toAgentId}`;
    } else if (type === 'command' || type === 'new_command') {
      title = `新指令：${fromAgentId} → ${toAgentId}`;
    } else if (type === 'system_notification' && message) {
      title = message.substring(0, 50);
    }

    // 插入通知到数据库
    await db.insert(agentNotifications).values({
      notificationId,
      fromAgentId,
      toAgentId,
      notificationType: dbNotificationType,
      title,
      content: JSON.stringify(content),
      relatedTaskId: taskId,
      status: 'unread',
      priority: 'normal',
      isRead: false,
      metadata: data || {},
    });

    console.log(`✅ 通知已创建: notificationId=${notificationId}, type=${type}, from=${fromAgentId}, to=${toAgentId}`);

    return NextResponse.json({
      success: true,
      message: '通知已创建',
      data: {
        notificationId,
      },
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      {
        success: false,
        error: '创建通知失败',
      },
      { status: 500 }
    );
  }
}
