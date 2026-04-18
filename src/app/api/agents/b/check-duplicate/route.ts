/**
 * 检查是否有重复任务的 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema/correct-schema';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const body = await request.json();
    const { taskTitle, executionDate, mainExecutor } = body;

    console.log('🔵 [检查重复任务] 收到请求:', {
      taskTitle,
      executionDate,
      mainExecutor,
    });

    // 验证必填参数
    if (!taskTitle || !executionDate) {
      return NextResponse.json(
        { success: false, error: '缺少必填参数' },
        { status: 400 }
      );
    }

    // 计算当前时间和5分钟前的时间
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    // 🔥 修复：将 Date 对象转为 ISO 字符串，避免 Drizzle 序列化失败
    const fiveMinutesAgoISO = fiveMinutesAgo.toISOString();

    // 检查：5分钟内，相同 taskTitle + executionDate + mainExecutor 的任务是否已经创建过
    // 注意：使用 metadata 中的 originalTaskTitle 和 executionDate 来判断
    // 必须加 metadata IS NOT NULL 条件，否则 NULL->>'key' 在某些 PG 版本会报错
    const recentDuplicate = await db
      .select()
      .from(agentSubTasks)
      .where(
        sql`
          metadata IS NOT NULL
          AND metadata->>'originalTaskTitle' = ${taskTitle}
          AND metadata->>'source' = 'agent-b-simple-split'
          AND from_parents_executor = ${mainExecutor}
          AND created_at >= ${fiveMinutesAgoISO}
        `
      )
      .limit(1);

    const hasDuplicate = recentDuplicate.length > 0;

    console.log('🔵 [检查重复任务] 结果:', { hasDuplicate });

    return NextResponse.json({
      success: true,
      hasDuplicate,
      duplicateInfo: hasDuplicate ? {
        taskId: recentDuplicate[0].id,
        createdAt: recentDuplicate[0].createdAt,
      } : null,
    });

  } catch (error: any) {
    console.error('❌ [检查重复任务] 失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '检查失败' },
      { status: 500 }
    );
  }
}
