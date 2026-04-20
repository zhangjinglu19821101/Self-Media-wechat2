/**
 * 信息速记提醒定时任务
 * 负责检查并触发到期的提醒
 */

import { db } from '@/lib/db';
import { infoSnippets } from '@/lib/db/schema/info-snippets';
import { and, eq, lte, isNotNull } from 'drizzle-orm';

/**
 * 触发信息速记提醒
 * 查询所有到期的提醒，更新状态为 triggered
 * 
 * @returns 触发的提醒数量和详情
 */
export async function triggerSnippetReminders(): Promise<{
  triggered: number;
  reminders: Array<{
    id: string;
    title: string | null;
    summary: string | null;
    remindAt: Date | null;
  }>;
}> {
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
    return {
      triggered: 0,
      reminders: [],
    };
  }

  // 批量更新提醒状态为 triggered
  for (const reminder of dueReminders) {
    await db.update(infoSnippets)
      .set({
        remindStatus: 'triggered',
        remindedAt: now,
        updatedAt: now,
      })
      .where(eq(infoSnippets.id, reminder.id));
  }

  console.log(`[snippet-reminders] 已触发 ${dueReminders.length} 个提醒`);

  return {
    triggered: dueReminders.length,
    reminders: dueReminders.map(r => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      remindAt: r.remindAt,
    })),
  };
}
