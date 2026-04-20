/**
 * 获取当前用户触发的提醒并标记为已读
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { infoSnippets } from '@/lib/db/schema/info-snippets';
import { and, eq } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';

/**
 * GET /api/info-snippets/triggered-reminders
 * 获取当前用户已触发但未处理的提醒
 */
export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    
    const reminders = await db.select()
      .from(infoSnippets)
      .where(
        and(
          eq(infoSnippets.workspaceId, workspaceId),
          eq(infoSnippets.snippetType, 'reminder'),
          eq(infoSnippets.remindStatus, 'triggered')
        )
      );

    return NextResponse.json({
      success: true,
      data: reminders,
    });
  } catch (error: any) {
    console.error('[triggered-reminders GET] 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
