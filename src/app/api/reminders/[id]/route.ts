/**
 * 提醒 API - 单个操作
 * 
 * GET: 获取提醒详情
 * PUT: 更新提醒
 * DELETE: 删除提醒
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceId } from '@/lib/auth/context';
import {
  getReminder,
  updateReminder,
  deleteReminder,
} from '@/lib/services/reminder-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const workspaceId = await getWorkspaceId(request);
    if (!workspaceId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const reminder = await getReminder(id, workspaceId);

    if (!reminder) {
      return NextResponse.json({ error: '提醒不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: reminder });
  } catch (error) {
    console.error('[API /reminders/[id]] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取提醒失败' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const workspaceId = await getWorkspaceId(request);
    if (!workspaceId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const reminder = await updateReminder(id, workspaceId, body);

    if (!reminder) {
      return NextResponse.json({ error: '提醒不存在或更新失败' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: reminder });
  } catch (error) {
    console.error('[API /reminders/[id]] PUT error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新提醒失败' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const workspaceId = await getWorkspaceId(request);
    if (!workspaceId) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id } = await params;
    const deleted = await deleteReminder(id, workspaceId);

    if (!deleted) {
      return NextResponse.json({ error: '提醒不存在或删除失败' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: '提醒已删除' });
  } catch (error) {
    console.error('[API /reminders/[id]] DELETE error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除提醒失败' },
      { status: 500 }
    );
  }
}
