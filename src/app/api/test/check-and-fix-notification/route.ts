import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentNotifications, tasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    console.log('🔍 [检查并修复通知] 开始...');

    // 1. 查询所有 insurance-d 相关的通知
    const notifications = await db
      .select()
      .from(agentNotifications)
      .where(eq(agentNotifications.notificationType, 'insurance_d_split_result'))
      .orderBy(agentNotifications.createdAt)
      .limit(5);

    console.log(`✅ 找到 ${notifications.length} 条 insurance-d 通知`);

    // 2. 检查并修复每条通知
    const fixes = [];
    for (const notification of notifications) {
      console.log(`\n📄 检查通知: ${notification.notificationId}`);
      console.log(`   - is_read: ${notification.isRead}`);
      console.log(`   - status: ${notification.status}`);
      console.log(`   - content 类型: ${typeof notification.content}`);
      
      let contentObj;
      if (typeof notification.content === 'string') {
        try {
          contentObj = JSON.parse(notification.content);
          console.log(`   - content 解析成功`);
        } catch (e) {
          console.log(`   - content 解析失败:`, e);
        }
      } else {
        contentObj = notification.content;
      }

      if (contentObj) {
        console.log(`   - content.hasOwnProperty('splitResult'): ${contentObj.hasOwnProperty('splitResult')}`);
        console.log(`   - content.hasOwnProperty('result'): ${contentObj.hasOwnProperty('result')}`);
      }

      // 3. 修复通知
      const updateData: any = {};
      
      if (notification.isRead !== false) {
        updateData.isRead = false;
        console.log(`   🔧 修复 is_read: ${notification.isRead} -> false`);
      }
      
      if (notification.status !== 'unread') {
        updateData.status = 'unread';
        console.log(`   🔧 修复 status: ${notification.status} -> unread`);
      }

      if (Object.keys(updateData).length > 0) {
        await db
          .update(agentNotifications)
          .set(updateData)
          .where(eq(agentNotifications.notificationId, notification.notificationId));
        
        fixes.push({
          notificationId: notification.notificationId,
          fixes: updateData
        });
      }
    }

    // 4. 查询当前任务状态
    const task = await db
      .select()
      .from(tasks)
      .where(eq(tasks.taskId, 'task-d692763c-5caf-4f92-a307-81a2c4d34d02'));

    console.log(`\n📋 任务状态:`, task[0]?.taskStatus);

    return NextResponse.json({
      success: true,
      notificationCount: notifications.length,
      fixes: fixes,
      taskStatus: task[0]?.taskStatus,
      notifications: notifications.map(n => ({
        notificationId: n.notificationId,
        isRead: n.isRead,
        status: n.status,
        createdAt: n.createdAt
      }))
    });
  } catch (error) {
    console.error('❌ [检查并修复通知] 错误:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
