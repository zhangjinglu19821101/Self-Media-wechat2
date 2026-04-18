/**
 * 查询指定 commandResultId 下的写作任务
 * GET /api/agents/tasks/writing-task?commandResultId=xxx&executor=insurance-xiaohongshu
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(request.url);
    const commandResultId = searchParams.get('commandResultId');
    const executor = searchParams.get('executor');

    if (!commandResultId) {
      return NextResponse.json({ error: '缺少 commandResultId' }, { status: 400 });
    }

    // 构建查询条件
    const conditions = [eq(agentSubTasks.commandResultId, commandResultId)];
    
    if (executor) {
      conditions.push(eq(agentSubTasks.fromParentsExecutor, executor));
    }

    const tasks = await db
      .select({
        id: agentSubTasks.id,
        taskTitle: agentSubTasks.taskTitle,
        status: agentSubTasks.status,
        executor: agentSubTasks.fromParentsExecutor,
        orderIndex: agentSubTasks.orderIndex,
      })
      .from(agentSubTasks)
      .where(and(...conditions))
      .orderBy(agentSubTasks.orderIndex);

    return NextResponse.json({
      success: true,
      tasks,
    });
  } catch (error) {
    console.error('[Writing Task API] 查询失败:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
