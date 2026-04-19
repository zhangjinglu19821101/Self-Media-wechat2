/**
 * 获取已完成的任务列表（用于内容导出）
 * 
 * GET /api/subtasks/completed
 * 
 * 查询参数：
 * - limit: 返回数量限制（默认 50）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq, desc, inArray, and, isNotNull, or } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';
import { WRITING_AGENT_IDS } from '@/lib/agents/agent-registry';

export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // 查询已完成的写作任务（允许 workspaceId 为空或匹配）
    const completedTasks = await db
      .select({
        id: agentSubTasks.id,
        taskTitle: agentSubTasks.taskTitle,
        executor: agentSubTasks.fromParentsExecutor, // 数据库字段是 from_parents_executor
        status: agentSubTasks.status,
        completedAt: agentSubTasks.completedAt,
        resultData: agentSubTasks.resultData,
        resultText: agentSubTasks.resultText,
        commandResultId: agentSubTasks.commandResultId,
        workspaceId: agentSubTasks.workspaceId,
      })
      .from(agentSubTasks)
      .where(and(
        or(
          eq(agentSubTasks.workspaceId, workspaceId),
          eq(agentSubTasks.workspaceId, ''),
          isNotNull(agentSubTasks.workspaceId).not() // 允许任意 workspaceId
        ),
        eq(agentSubTasks.status, 'completed'),
        inArray(agentSubTasks.fromParentsExecutor, WRITING_AGENT_IDS), // 使用正确的字段名
        isNotNull(agentSubTasks.completedAt)
      ))
      .orderBy(desc(agentSubTasks.completedAt))
      .limit(limit);

    // 从 resultData 中提取 articleTitle（修正提取路径）
    const tasksWithArticleTitle = completedTasks.map(task => {
      const resultData = task.resultData as any;
      const articleTitle = 
        resultData?.executorOutput?.structuredResult?.resultContent?.articleTitle ||
        resultData?.structuredResult?.resultContent?.articleTitle ||
        resultData?.articleTitle ||
        null;
      
      return {
        ...task,
        articleTitle,
      };
    });

    return NextResponse.json({
      success: true,
      data: tasksWithArticleTitle,
      total: tasksWithArticleTitle.length,
    });

  } catch (error) {
    console.error('[API] 获取已完成任务失败:', error);
    return NextResponse.json(
      { success: false, error: '获取失败' },
      { status: 500 }
    );
  }
}
