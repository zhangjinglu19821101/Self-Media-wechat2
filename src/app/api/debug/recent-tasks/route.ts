import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask } from '@/lib/db/schema';
import { desc, sql } from 'drizzle-orm';

/**
 * 查询最近的任务
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');

    const tasks = await db
      .select()
      .from(dailyTask)
      .orderBy(desc(dailyTask.createdAt))
      .limit(limit);

    return NextResponse.json({
      success: true,
      data: tasks,
      count: tasks.length,
    });
  } catch (error) {
    console.error('查询任务失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
