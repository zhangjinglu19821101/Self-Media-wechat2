/**
 * POST /api/notifications/update-metadata
 * 更新通知的 metadata
 *
 * 请求体：
 * {
 *   notificationId: "uuid",
 *   metadata: { ... }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { agentNotifications } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const body = await request.json();
    const { notificationId, metadata } = body;

    if (!notificationId || !metadata) {
      return NextResponse.json(
        { success: false, error: '缺少必填参数：notificationId, metadata' },
        { status: 400 }
      );
    }

    console.log(`📝 更新通知 metadata: notificationId=${notificationId}, metadata=`, metadata);

    // 1. 先查询现有通知
    const existingNotifications = await db
      .select()
      .from(agentNotifications)
      .where(eq(agentNotifications.notificationId, notificationId))
      .limit(1);

    if (existingNotifications.length === 0) {
      return NextResponse.json(
        { success: false, error: '通知不存在' },
        { status: 404 }
      );
    }

    const existingNotification = existingNotifications[0];
    const existingMetadata = existingNotification.metadata || {};

    // 2. 合并 metadata（保留原有数据，只更新新字段）
    const mergedMetadata = {
      ...existingMetadata,
      ...metadata,
    };

    console.log(`🔄 合并 metadata:`, {
      existing: Object.keys(existingMetadata),
      new: Object.keys(metadata),
      merged: Object.keys(mergedMetadata),
    });

    // 3. 更新通知 metadata（使用合并后的数据）
    await db
      .update(agentNotifications)
      .set({
        metadata: mergedMetadata,
      })
      .where(eq(agentNotifications.notificationId, notificationId));

    console.log(`✅ 通知 metadata 已更新: ${notificationId}`);

    return NextResponse.json({
      success: true,
      message: '通知 metadata 已更新',
    });
  } catch (error) {
    console.error('❌ 更新通知 metadata 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
