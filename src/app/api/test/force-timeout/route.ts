/**
 * 强制设置子任务超时（用于测试）
 * POST /api/test/force-timeout
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const { subtaskId } = await request.json();

    if (!subtaskId) {
      return NextResponse.json(
        { success: false, error: '缺少 subtaskId 参数' },
        { status: 400 }
      );
    }

    // 把 startedAt 往前调整 11 分钟，确保超时
    const elevenMinutesAgo = new Date(Date.now() - 11 * 60 * 1000);

    await db
      .update(agentSubTasks)
      .set({
        startedAt: elevenMinutesAgo,
        updatedAt: new Date(),
      })
      .where(eq(agentSubTasks.id, subtaskId));

    // 查询更新后的任务
    const tasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, subtaskId))
      .limit(1);

    return NextResponse.json({
      success: true,
      message: '已强制设置任务超时',
      data: {
        taskId: subtaskId,
        newStartedAt: elevenMinutesAgo.toISOString(),
        task: tasks[0],
      },
    });
  } catch (error) {
    console.error('强制设置超时失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '操作失败',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    name: 'force-timeout',
    description: '强制设置子任务超时（用于测试）',
    usage: {
      method: 'POST',
      endpoint: '/api/test/force-timeout',
      body: {
        subtaskId: '子任务ID',
      },
    },
  });
}
