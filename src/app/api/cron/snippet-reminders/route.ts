/**
 * 信息速记提醒定时任务
 * 每分钟检查一次待提醒的速记，触发提醒
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { infoSnippets } from '@/lib/db/schema/info-snippets';
import { and, eq, lte, isNotNull, sql } from 'drizzle-orm';

/**
 * GET /api/cron/snippet-reminders
 * 检查并触发到期的提醒
 * 
 * 该接口应由定时任务调用，每分钟执行一次
 * 可以通过外部 cron 服务或内部定时器触发
 */
export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    
    // 查询所有到期的提醒
    const dueReminders = await db.select()
      .from(infoSnippets)
      .where(
        and(
          eq(infoSnippets.snippetType, 'reminder'),
          eq(infoSnippets.remindStatus, 'pending'),
          isNotNull(infoSnippets.remindAt),
          lte(infoSnippets.remindAt, now)
        )
      );

    if (dueReminders.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有需要触发的提醒',
        triggered: 0,
      });
    }

    // 批量更新提醒状态为 triggered
    const triggeredIds: string[] = [];
    for (const reminder of dueReminders) {
      await db.update(infoSnippets)
        .set({
          remindStatus: 'triggered',
          remindedAt: now,
          updatedAt: now,
        })
        .where(eq(infoSnippets.id, reminder.id));
      
      triggeredIds.push(reminder.id);
    }

    // TODO: 这里可以集成 WebSocket 推送或通知服务
    // 发送实时提醒给用户
    // await sendReminders(dueReminders);

    return NextResponse.json({
      success: true,
      message: `已触发 ${triggeredIds.length} 个提醒`,
      triggered: triggeredIds.length,
      reminders: dueReminders.map(r => ({
        id: r.id,
        title: r.title,
        sourceOrg: r.sourceOrg,
        summary: r.summary,
        remindAt: r.remindAt,
      })),
    });
  } catch (error: any) {
    console.error('[snippet-reminders] 错误:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
