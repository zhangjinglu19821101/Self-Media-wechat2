/**
 * 信息速记提醒定时任务
 * 负责检查并触发到期的提醒
 */

import { db } from '@/lib/db';
import { infoSnippets } from '@/lib/db/schema/info-snippets';
import { and, eq, lte, isNotNull } from 'drizzle-orm';

/**
 * 触发信息速记提醒
 * 查询所有到期的提醒，原子性更新状态为 triggered
 * 
 * 使用 UPDATE ... WHERE ... RETURNING 原子操作，避免多实例重复触发
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
  
  // 🔒 原子操作：直接 UPDATE + RETURNING，避免查询-更新之间的竞态
  // 只更新 remindStatus = 'pending' 的记录，已更新的不会再被匹配
  const updated = await db.update(infoSnippets)
    .set({
      remindStatus: 'triggered',
      remindedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(infoSnippets.snippetType, 'reminder'),
        eq(infoSnippets.remindStatus, 'pending'),
        isNotNull(infoSnippets.remindAt),
        lte(infoSnippets.remindAt, now)
      )
    )
    .returning({
      id: infoSnippets.id,
      title: infoSnippets.title,
      summary: infoSnippets.summary,
      remindAt: infoSnippets.remindAt,
    });

  if (updated.length > 0) {
    console.log(`[snippet-reminders] 已触发 ${updated.length} 个提醒`);
  }

  return {
    triggered: updated.length,
    reminders: updated,
  };
}
