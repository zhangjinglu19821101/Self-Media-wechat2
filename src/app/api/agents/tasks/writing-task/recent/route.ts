/**
 * 获取最近完成的写作任务列表
 * GET /api/agents/tasks/writing-task/recent
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { desc, eq, inArray, or } from 'drizzle-orm';
import { WRITING_AGENTS } from '@/lib/agents/agent-registry';

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    // 获取 workspaceId
    const workspaceId = request.headers.get('x-workspace-id') || 'default-workspace';

    // 查询最近完成的写作任务
    const tasks = await db
      .select({
        id: agentSubTasks.id,
        taskTitle: agentSubTasks.taskTitle,
        status: agentSubTasks.status,
        executor: agentSubTasks.fromParentsExecutor,
        commandResultId: agentSubTasks.commandResultId,
        updatedAt: agentSubTasks.updatedAt,
        metadata: agentSubTasks.metadata,
      })
      .from(agentSubTasks)
      .where(
        or(
          eq(agentSubTasks.status, 'completed'),
          eq(agentSubTasks.status, 'waiting_user')
        )
      )
      .orderBy(desc(agentSubTasks.updatedAt))
      .limit(20);

    // 过滤出写作任务
    const writingTasks = tasks.filter(task => 
      WRITING_AGENTS.includes(task.executor as any) || 
      task.executor === 'user_preview_edit'
    );

    // 格式化返回
    const formattedTasks = writingTasks.map(task => ({
      id: task.id,
      taskTitle: task.taskTitle,
      status: task.status,
      executor: task.executor,
      platform: (task.metadata as any)?.platform || 
        (task.executor === 'insurance-xiaohongshu' ? 'xiaohongshu' : 
         task.executor === 'insurance-d' ? 'wechat_official' : 'unknown'),
      commandResultId: task.commandResultId,
      updatedAt: task.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      tasks: formattedTasks,
    });
  } catch (error) {
    console.error('[Recent Tasks API] 查询失败:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}
