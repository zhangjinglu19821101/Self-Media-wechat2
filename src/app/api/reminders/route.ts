/**
 * 提醒 API - 列表 + 创建 + 人物摘要 + 统计
 * 
 * GET: 获取提醒列表（支持分组/列表/统计/人物摘要）
 * POST: 创建新提醒
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceId } from '@/lib/auth/context';
import {
  listReminders,
  listRemindersGrouped,
  getReminderStats,
  getPersonSummaries,
  createReminder,
  type CreateReminderInput,
} from '@/lib/services/reminder-service';
import type { ReminderStatus, Direction } from '@/lib/db/schema/reminders';

export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    if (!workspaceId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('mode') || 'grouped';

    switch (mode) {
      case 'stats': {
        const stats = await getReminderStats(workspaceId);
        return NextResponse.json({ success: true, data: stats });
      }

      case 'persons': {
        const persons = await getPersonSummaries(workspaceId);
        return NextResponse.json({ success: true, data: persons });
      }

      case 'list': {
        const direction = searchParams.get('direction') as Direction | null;
        const status = searchParams.get('status') as ReminderStatus | null;
        const keyword = searchParams.get('keyword') || undefined;
        const personName = searchParams.get('personName') || undefined;
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('pageSize') || '50');

        const result = await listReminders(workspaceId, {
          direction: direction || undefined,
          status: status || 'all',
          keyword,
          personName,
          page,
          pageSize,
        });
        return NextResponse.json({ success: true, data: result.data, total: result.total });
      }

      case 'grouped':
      default: {
        const direction = searchParams.get('direction') as Direction | null;
        const grouped = await listRemindersGrouped(workspaceId, direction || undefined);
        return NextResponse.json({ success: true, data: grouped });
      }
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
    const { requesterName, assigneeName, content, remindAt, direction, repeatMode, notifyMethods } = body;

    if (!requesterName || !assigneeName || !content || !remindAt) {
      return NextResponse.json(
        { error: '要求者、被要求者、内容和提醒时间为必填项' },
        { status: 400 }
      );
    }

    const input: CreateReminderInput = {
      requesterName,
      assigneeName,
      content,
      direction: direction || 'outbound',
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
