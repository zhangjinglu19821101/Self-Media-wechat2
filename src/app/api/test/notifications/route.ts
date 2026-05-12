import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentNotifications, agentTasks, dailyTask, agentSubTasks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * 查询失败通知
 * 
 * GET /api/test/notifications?taskId=xxx
 * 
 * 功能：
 * 查询指定任务或所有失败通知
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    console.log(`📨 查询失败通知`);
    if (taskId) {
      console.log(`  📍 任务ID: ${taskId}`);
    }

    // 1. 查询失败通知
    const whereConditions = eq(agentNotifications.notificationType, 'failure');
    
    let notifications;
    if (taskId) {
      notifications = await db
        .select()
        .from(agentNotifications)
        .where(
          and(
            eq(agentNotifications.notificationType, 'failure'),
            eq(agentNotifications.relatedTaskId, taskId)
          )
        )
        .orderBy(agentNotifications.createdAt)
        .limit(20);
    } else {
      notifications = await db
        .select()
        .from(agentNotifications)
        .where(whereConditions)
        .orderBy(agentNotifications.createdAt)
        .limit(20);
    }

    console.log(`✅ 查询到 ${notifications.length} 条失败通知`);

    // 2. 统计各类型通知
    const statistics = {
      total: notifications.length,
      unread: notifications.filter(n => !n.isRead).length,
      read: notifications.filter(n => n.isRead).length,
      highPriority: notifications.filter(n => n.priority === 'high' || n.priority === 'urgent').length,
    };

    return NextResponse.json({
      success: true,
      message: '查询成功',
      data: {
        notifications,
        statistics,
      }
    }, { status: 200 });
  } catch (error: any) {
    console.error(`❌ 查询失败通知失败:`, error);

    return NextResponse.json({
      success: false,
      error: error.message,
      message: error.message,
    }, { status: 500 });
  }
}

/**
 * 创建测试通知
 * 
 * POST /api/test/notifications
 * 
 * 请求体：
 * {
 *   "taskId": "任务ID（可选）",
 *   "toAgentId": "接收方Agent ID",
 *   "title": "通知标题",
 *   "content": "通知内容"
 * }
 * 
 * 功能：
 * 创建一条测试失败通知
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, toAgentId = 'A', title = '测试失败通知', content = '这是一条测试失败通知' } = body;

    console.log(`📨 创建测试失败通知`);
    console.log(`  📋 标题: ${title}`);
    console.log(`  👥 接收方: ${toAgentId}`);
    if (taskId) {
      console.log(`  📍 任务ID: ${taskId}`);
    }

    const notificationId = `notify-test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const [notification] = await db
      .insert(agentNotifications)
      .values({
        notificationId,
        fromAgentId: 'system',
        toAgentId,
        notificationType: 'failure',
        title,
        content,
        relatedTaskId: taskId,
        status: 'unread',
        priority: 'normal',
        isRead: false
      })
      .returning();

    console.log(`✅ 测试失败通知创建成功`);

    return NextResponse.json({
      success: true,
      message: '测试失败通知创建成功',
      data: notification,
    }, { status: 201 });
  } catch (error: any) {
    console.error(`❌ 创建测试失败通知失败:`, error);

    return NextResponse.json({
      success: false,
      error: error.message,
      message: error.message,
    }, { status: 500 });
  }
}
