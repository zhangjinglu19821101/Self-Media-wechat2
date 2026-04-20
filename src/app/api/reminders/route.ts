/**
 * 提醒 API - 列表 + 创建
 * 
 * GET: 获取提醒列表（支持分组和统计）
 * POST: 创建新提醒
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceId } from '@/lib/auth/context';
import {
  listReminders,
  listRemindersGrouped,
  getReminderStats,
  createReminder,
  type CreateReminderInput,
} from '@/lib/services/reminder-service';
import type { ReminderStatus } from '@/lib/db/schema/reminders';

export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    if (!workspaceId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('mode') || 'grouped'; // grouped | list | stats
    const status = searchParams.get('status') as ReminderStatus | null;

    switch (mode) {
      case 'stats':
        const stats = await getReminderStats(workspaceId);
        return NextResponse.json({ success: true, data: stats });

      case 'list':
        const list = await listReminders(workspaceId, status || 'all');
        return NextResponse.json({ success: true, data: list });

      case 'grouped':
      default:
        const grouped = await listRemindersGrouped(workspaceId);
        return NextResponse.json({ success: true, data: grouped });
    }
  } catch (error) {
    console.error('[API /reminders] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取提醒失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    if (!workspaceId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const { content, remindAt, repeatMode, notifyMethods } = body;

    if (!content || !remindAt) {
      return NextResponse.json({ error: '内容和提醒时间为必填项' }, { status: 400 });
    }

    const input: CreateReminderInput = {
      content,
      remindAt: new Date(remindAt),
      repeatMode: repeatMode || 'once',
      notifyMethods: notifyMethods || ['browser', 'popup'],
      workspaceId,
    };

    const reminder = await createReminder(input);
    return NextResponse.json({ success: true, data: reminder });
  } catch (error) {
    console.error('[API /reminders] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建提醒失败' },
      { status: 500 }
    );
  }
}
