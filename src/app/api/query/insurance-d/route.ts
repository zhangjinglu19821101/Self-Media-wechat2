/**
 * GET /api/query/insurance-d
 * 查询 insurance-d 相关的 daily_task 表数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask } from '@/lib/db/schema';
import { eq, and, gte, lte, desc, like } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get('taskId');
    const executor = searchParams.get('executor');
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const limit = parseInt(searchParams.get('limit') || '50');

    console.log(`📋 查询 insurance-d 表: taskId=${taskId}, executor=${executor}, startTime=${startTime}, endTime=${endTime}, limit=${limit}`);

    // 构建查询条件
    const conditions = [];

    if (taskId) {
      conditions.push(like(dailyTask.taskId, `%${taskId}%`));
    }

    if (executor) {
      conditions.push(eq(dailyTask.executor, executor));
    }

    if (startTime) {
      conditions.push(gte(dailyTask.createdAt, new Date(startTime)));
    }

    if (endTime) {
      conditions.push(lte(dailyTask.createdAt, new Date(endTime)));
    }

    // 执行查询
    const tasks = await db
      .select({
        id: dailyTask.id,
        taskId: dailyTask.taskId,
        taskTitle: dailyTask.taskTitle,
        taskDescription: dailyTask.taskDescription,
        executor: dailyTask.executor,
        executionStatus: dailyTask.executionStatus,
        createdAt: dailyTask.createdAt,
        updatedAt: dailyTask.updatedAt,
      })
      .from(dailyTask)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(dailyTask.createdAt))
      .limit(limit);

    console.log(`✅ 查询成功: 找到 ${tasks.length} 条记录`);

    return NextResponse.json({
      success: true,
      data: {
        tasks,
        count: tasks.length,
      },
    });
  } catch (error) {
    console.error('❌ 查询 insurance-d 表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
