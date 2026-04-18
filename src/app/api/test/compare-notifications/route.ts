/**
 * 对比分析通知数据结构
 * GET /api/test/compare-notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL ||
  process.env.PGDATABASE_URL ||
  'postgresql://user_7601448662618718259:bcc5e558-7809-4848-a97d-8b4817215e92@cp-deft-wind-b35fb7fc.pg4.aidap-global.cn-beijing.volces.com:5432/Database_1769852048532?sslmode=require&channel_binding=require';

export async function GET(request: NextRequest) {
  try {
    const sql = postgres(DATABASE_URL, {
      ssl: 'require',
      max: 1,
    });

    console.log('🔍 [对比分析] 查询所有通知...');

    // 查询所有通知，按创建时间排序
    const notifications = await sql`
      SELECT 
        notification_id,
        notification_type,
        from_agent_id,
        to_agent_id,
        related_task_id,
        title,
        content,
        metadata,
        is_read,
        created_at
      FROM agent_notifications
      WHERE to_agent_id = 'A'
      ORDER BY created_at DESC
      LIMIT 10
    `;

    console.log(`✅ [对比分析] 找到 ${notifications.length} 条通知`);

    // 分析每条通知的数据结构
    const analysis = notifications.map((notif, index) => {
      let content = notif.content;
      try {
        if (typeof content === 'string') {
          content = JSON.parse(content);
        }
      } catch (e) {
        // 保持原样
      }

      // 分析数据结构
      const hasResult = !!(content?.result);
      const hasSplitResult = !!(content?.splitResult);
      const hasSubTasksDirect = !!(content?.result?.subTasks || content?.result?.subtasks);
      const hasSubTasksInTasks = !!(content?.splitResult?.tasks?.[0]?.subTasks);
      
      return {
        index,
        notificationId: notif.notification_id,
        notificationType: notif.notification_type,
        fromAgentId: notif.from_agent_id,
        createdAt: notif.created_at,
        isRead: notif.is_read,
        structure: {
          hasResult,
          hasSplitResult,
          hasSubTasksDirect,
          hasSubTasksInTasks,
        },
        contentKeys: Object.keys(content || {}),
        metadataKeys: Object.keys(notif.metadata || {}),
        // 数据路径提示
        recommendedPath: hasSubTasksDirect 
          ? 'content.result.subTasks' 
          : hasSubTasksInTasks 
            ? 'content.splitResult.tasks[0].subTasks' 
            : 'unknown',
      };
    });

    await sql.end();

    return NextResponse.json({
      success: true,
      count: notifications.length,
      analysis,
      rawNotifications: notifications.map(notif => ({
        ...notif,
        content: typeof notif.content === 'string' ? notif.content.substring(0, 200) + '...' : notif.content,
      })),
    });
  } catch (error) {
    console.error('❌ [对比分析] 查询失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
