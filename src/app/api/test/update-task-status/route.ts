/**
 * POST /api/test/update-task-status
 * 更新任务状态的测试接口
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { agentSubTasks } from '@/lib/db/schema';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

export async function POST(request: NextRequest) {
  try {
    const { taskId, newStatus } = await request.json();

    if (!taskId || !newStatus) {
      return NextResponse.json(
        { error: '缺少 taskId 或 newStatus 参数' },
        { status: 400 }
      );
    }

    console.log('🔄 更新任务状态:', {
      taskId,
      newStatus,
      timestamp: getCurrentBeijingTime().toISOString()
    });

    // 更新任务状态
    const result = await db
      .update(agentSubTasks)
      .set({
        status: newStatus,
        updatedAt: getCurrentBeijingTime()
      })
      .where(eq(agentSubTasks.id, taskId))
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { error: '任务不存在' },
        { status: 404 }
      );
    }

    console.log('✅ 任务状态更新成功:', {
      taskId: result[0].id,
      oldStatus: result[0].status,
      newStatus
    });

    return NextResponse.json({
      success: true,
      data: {
        taskId: result[0].id,
        status: newStatus,
        updatedAt: result[0].updatedAt
      }
    });
  } catch (error) {
    console.error('❌ 更新任务状态失败:', error);
    return NextResponse.json(
      {
        error: '更新任务状态失败',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
