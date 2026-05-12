/**
 * 重置通知的 splitPopupStatus 状态
 * POST /api/test/reset-notification-status
 */

import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/multi_platform_publish_db?sslmode=require&channel_binding=require';

export async function POST(request: NextRequest) {
  try {
    const sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 1,
    });

    console.log('🔍 [重置状态] 开始重置通知状态...');

    // 查询所有 insurance_d_split_result 类型的通知
    const notifications = await sql`
      SELECT 
        notification_id,
        notification_type,
        metadata
      FROM agent_notifications
      WHERE notification_type = 'insurance_d_split_result'
        AND to_agent_id = 'A'
      ORDER BY created_at DESC
    `;

    console.log(`✅ [重置状态] 找到 ${notifications.length} 条 insurance_d_split_result 通知`);

    // 重置每条通知的 splitPopupStatus
    let resetCount = 0;
    for (const notif of notifications) {
      const oldMetadata = notif.metadata || {};
      const newMetadata = {
        ...oldMetadata,
        splitPopupStatus: null,  // 重置为 null，让弹框可以重新显示
        popupShownAt: null,
      };

      await sql`
        UPDATE agent_notifications
        SET metadata = ${newMetadata}
        WHERE notification_id = ${notif.notification_id}
      `;

      console.log(`   ✅ 已重置: ${notif.notification_id}, splitPopupStatus: ${oldMetadata.splitPopupStatus || 'null'} → null`);
      resetCount++;
    }

    await sql.end();

    return NextResponse.json({
      success: true,
      message: `已重置 ${resetCount} 条通知的弹框状态`,
      resetCount,
    });
  } catch (error) {
    console.error('❌ [重置状态] 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
