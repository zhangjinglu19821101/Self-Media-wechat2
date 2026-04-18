/**
 * POST /api/agents/[id]/notifications/read
 * 标记指定Agent的所有未读通知为已读
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentNotifications } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;

    // 获取要标记的通知ID列表（可选）
    const body = await request.json().catch(() => ({}));
    const { notificationIds } = body;

    if (notificationIds && Array.isArray(notificationIds) && notificationIds.length > 0) {
      // 标记指定的通知为已读
      await db
        .update(agentNotifications)
        .set({ isRead: true })
        .where(
          and(
            eq(agentNotifications.notificationId, notificationIds[0] as string), // 注意：这里需要处理多个ID的情况
            eq(agentNotifications.toAgentId, agentId)
          )
        );
    } else {
      // 标记该Agent的所有未读通知为已读
      await db
        .update(agentNotifications)
        .set({ isRead: true })
        .where(
          and(
            eq(agentNotifications.toAgentId, agentId),
            eq(agentNotifications.isRead, false)
          )
        );
    }

    return NextResponse.json({
      success: true,
      message: '通知已标记为已读',
    });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return NextResponse.json(
      {
        success: false,
        error: '标记通知失败',
      },
      { status: 500 }
    );
  }
}
