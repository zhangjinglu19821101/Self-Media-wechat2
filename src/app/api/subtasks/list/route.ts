import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/context';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { workspaceId } = authResult;

    const tasks = await db
      .select()
      .from(agentSubTasks)
      .where(and(eq(agentSubTasks.status, 'in_progress'), eq(agentSubTasks.workspaceId, workspaceId)));

    return NextResponse.json({
      success: true,
      tasks,
    });
  } catch (error) {
    console.error(`❌ 获取子任务失败:`, error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    }, { status: 500 });
  }
}
