/**
 * 提醒完成 API
 * 
 * POST: 标记提醒为已完成
 * - 对于一次性提醒，直接标记完成
 * - 对于重复提醒，标记完成并创建下一次提醒
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceId } from '@/lib/auth/context';
import { completeReminder } from '@/lib/services/reminder-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const workspaceId = await getWorkspaceId(request);
    if (!workspaceId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const reminder = await completeReminder(id, workspaceId);

    if (!reminder) {
      return NextResponse.json({ error: '提醒不存在或操作失败' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: reminder,
      message: reminder.repeatMode !== 'once'
        ? '提醒已完成，已创建下一次提醒'
        : '提醒已完成',
    });
  } catch (error) {
    console.error('[API /reminders/[id]/complete] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '完成提醒失败' },
      { status: 500 }
    );
  }
}
