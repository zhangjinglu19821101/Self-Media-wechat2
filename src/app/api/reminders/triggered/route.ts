/**
 * 已触发提醒 API
 * 
 * GET: 获取已触发的提醒列表（供前端轮询展示）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceId } from '@/lib/auth/context';
import { getTriggeredReminders } from '@/lib/services/reminder-service';

export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    if (!workspaceId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const reminders = await getTriggeredReminders(workspaceId);
    return NextResponse.json({ success: true, data: reminders });
  } catch (error) {
    console.error('[API /reminders/triggered] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取已触发提醒失败' },
      { status: 500 }
    );
  }
}
