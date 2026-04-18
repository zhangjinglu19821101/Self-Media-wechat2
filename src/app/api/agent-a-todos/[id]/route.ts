/**
 * Agent A 待办任务详情 API
 * 
 * 查询单个待办任务的详细信息
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentATodos, agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const maxDuration = 60;

/**
 * GET /api/agent-a-todos/[id]
 * 
 * 查询单个待办任务详情
 * 
 * 示例:
 * GET /api/agent-a-todos/550e8400-e29b-41d4-a716-446655440000
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    console.log('[Agent A Todo Detail API] 查询待办任务详情');
    console.log('[Agent A Todo Detail API] id:', id);

    // 查询待办任务
    const todos = await db
      .select()
      .from(agentATodos)
      .where(eq(agentATodos.id, id));

    if (todos.length === 0) {
      return NextResponse.json(
        { success: false, error: '未找到对应的待办任务' },
        { status: 404 }
      );
    }

    const todo = todos[0];

    // 查询关联的子任务信息
    const subTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, todo.subTaskId));

    console.log('[Agent A Todo Detail API] 查询成功');

    return NextResponse.json({
      success: true,
      data: {
        todo,
        subTask: subTasks[0] || null,
      },
    });
  } catch (error) {
    console.error('[Agent A Todo Detail API] 查询失败:', error);
    return NextResponse.json(
      { success: false, error: `查询失败: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
