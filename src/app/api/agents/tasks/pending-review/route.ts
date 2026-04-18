import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentTasks } from '@/lib/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/context';

/**
 * GET /api/agents/tasks/pending-review
 * 获取待确认拆解的任务列表
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { workspaceId } = authResult;

    console.log('📋 [pending-review] 获取待确认拆解的任务列表');

    // 查询待确认拆解的任务 - workspace 隔离
    const tasks = await db
      .select()
      .from(agentTasks)
      .where(and(eq(agentTasks.splitStatus, 'split_pending_review'), eq(agentTasks.workspaceId, workspaceId)))
      .orderBy(desc(agentTasks.createdAt));

    console.log(`✅ [pending-review] 找到 ${tasks.length} 个待确认任务`);

    return NextResponse.json({
      success: true,
      data: { tasks, count: tasks.length },
    });
  } catch (error) {
    console.error('❌ [pending-review] 获取待确认任务失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取待确认任务失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
