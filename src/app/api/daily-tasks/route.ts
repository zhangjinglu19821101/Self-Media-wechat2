/**
 * GET /api/daily-tasks
 * 查询 daily_task 表中的任务
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/context';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { workspaceId } = authResult;

    const searchParams = request.nextUrl.searchParams;
    const executor = searchParams.get('executor');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '10');

    console.log(`📋 查询 daily_task: executor=${executor}, status=${status}, limit=${limit}`);

    // 构建查询条件 - workspace 隔离
    const conditions = [eq(dailyTask.workspaceId, workspaceId)];

    if (executor) {
      conditions.push(eq(dailyTask.executor, executor));
    }

    if (status) {
      conditions.push(eq(dailyTask.executionStatus, status));
    }

    // 执行查询
    const tasks = await db
      .select()
      .from(dailyTask)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(dailyTask.createdAt))
      .limit(limit);

    console.log(`✅ 查询成功: 找到 ${tasks.length} 个 daily_task`);

    return NextResponse.json({
      success: true,
      data: {
        tasks,
        count: tasks.length,
      },
    });
  } catch (error) {
    console.error('❌ 查询 daily_task 失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
