/**
 * 标记提醒为已处理（dismissed）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { infoSnippets } from '@/lib/db/schema/info-snippets';
import { eq, and } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';

/**
 * POST /api/info-snippets/[id]/dismiss-reminder
 * 标记提醒为已处理
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { id } = await params;
    
    // 更新提醒状态
    const result = await db.update(infoSnippets)
      .set({
        remindStatus: 'dismissed',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(infoSnippets.id, id),
          eq(infoSnippets.workspaceId, workspaceId)
        )
      )
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: '未找到该提醒' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result[0],
    });
  } catch (error: any) {
    console.error('[dismiss-reminder] 错误:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
