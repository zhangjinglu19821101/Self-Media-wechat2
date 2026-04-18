/**
 * 发布历史 API
 * 
 * GET /api/publish/history
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getWorkspaceId } from '@/lib/auth/context';
import { publishQueue } from '@/lib/services/publish/publish-queue';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const workspaceId = await getWorkspaceId(request);
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status') || undefined;
    const platform = searchParams.get('platform') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const records = await publishQueue.getHistory(workspaceId, {
      status,
      platform,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: records,
    });
  } catch (error: any) {
    console.error('[Publish] 获取发布历史失败:', error);
    return NextResponse.json(
      { error: error.message || '获取发布历史失败' },
      { status: 500 }
    );
  }
}
