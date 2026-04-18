import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { agentNotifications } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/agents/notifications/mark-read
 *
 * 请求体：
 * {
 *   notificationId: "notif-A-B-split-xxx"
 * }
 *
 * 响应：
 * {
 *   success: true,
 *   message: "通知已标记为已读"
 * }
 */
export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const body = await request.json();
    const { notificationId } = body;

    if (!notificationId) {
      return NextResponse.json(
        { success: false, error: '缺少必填参数：notificationId' },
        { status: 400 }
      );
    }

    console.log(`📥 标记通知为已读: notificationId=${notificationId}`);

    // 更新通知状态为已读
    await db
      .update(agentNotifications)
      .set({
        isRead: true,
        status: 'read',
      })
      .where(eq(agentNotifications.notificationId, notificationId));

    console.log(`✅ 通知已标记为已读: ${notificationId}`);

    return NextResponse.json({
      success: true,
      message: '通知已标记为已读',
    });
  } catch (error) {
    console.error('❌ 标记通知为已读时出错:', error);
    return NextResponse.json(
      {
        success: false,
        error: '标记失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
