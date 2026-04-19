/**
 * Agent A 待办任务 API
 * 
 * 查询和管理 Agent A 的待办任务
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentATodos, agentSubTasks } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { AgentATodoQuery, AgentATodoProcessRequest } from '@/lib/types/capability-types';

export const maxDuration = 60;

/**
 * GET /api/agent-a-todos
 * 
 * 查询 Agent A 待办任务列表
 * 
 * 查询参数:
 * - status: 按状态过滤（可选）
 * - executor_agent_id: 按执行Agent ID过滤（可选）
 * - offset: 分页偏移（可选，默认0）
 * - limit: 分页限制（可选，默认20）
 * 
 * 示例:
 * GET /api/agent-a-todos?status=pending
 * GET /api/agent-a-todos?offset=0&limit=20
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const executorAgentId = searchParams.get('executor_agent_id');
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    console.log('[Agent A Todos API] 查询待办任务列表');
    console.log('[Agent A Todos API] 查询参数:', { status, executorAgentId, offset, limit });

    // 构建查询条件
    const conditions = [];
    if (status) {
      conditions.push(eq(agentATodos.status, status));
    }
    if (executorAgentId) {
      conditions.push(eq(agentATodos.executorAgentId, executorAgentId));
    }

    // 执行查询
    let results;
    if (conditions.length > 0) {
      results = await db
        .select()
        .from(agentATodos)
        .where(and(...conditions))
        .orderBy(desc(agentATodos.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      results = await db
        .select()
        .from(agentATodos)
        .orderBy(desc(agentATodos.createdAt))
        .limit(limit)
        .offset(offset);
    }

    // 获取总数
    let totalCount;
    if (conditions.length > 0) {
      const countResults = await db
        .select({ count: agentATodos.id })
        .from(agentATodos)
        .where(and(...conditions));
      totalCount = countResults.length;
    } else {
      const countResults = await db
        .select({ count: agentATodos.id })
        .from(agentATodos);
      totalCount = countResults.length;
    }

    console.log('[Agent A Todos API] 查询成功，返回', results.length, '条记录');

    return NextResponse.json({
      success: true,
      data: {
        todos: results,
        pagination: {
          total: totalCount,
          offset,
          limit,
        },
      },
    });
  } catch (error) {
    console.error('[Agent A Todos API] 查询失败:', error);
    return NextResponse.json(
      { success: false, error: `查询失败: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/agent-a-todos
 * 
 * 处理 Agent A 待办任务
 * 
 * 请求体:
 * {
 *   todoId: string;
 *   processedBy: string;
 *   solutionContent: string;
 *   status?: 'completed' | 'cancelled';
 * }
 */
export async function PUT(request: Request) {
  try {
    const body: AgentATodoProcessRequest = await request.json();
    const { todoId, processedBy, solutionContent, status = 'completed' } = body;

    console.log('[Agent A Todos API] 处理待办任务');
    console.log('[Agent A Todos API] todoId:', todoId);
    console.log('[Agent A Todos API] processedBy:', processedBy);
    console.log('[Agent A Todos API] status:', status);

    // 验证必填字段
    if (!todoId || !processedBy || !solutionContent) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: todoId, processedBy, solutionContent' },
        { status: 400 }
      );
    }

    // 验证状态
    if (!['completed', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { success: false, error: '无效的 status，只能是 completed 或 cancelled' },
        { status: 400 }
      );
    }

    // 更新任务
    const updatedTodos = await db
      .update(agentATodos)
      .set({
        solutionContent,
        status,
        processedBy,
        processedAt: new Date(),
        completedAt: status === 'completed' ? new Date() : null,
      })
      .where(eq(agentATodos.id, todoId))
      .returning();

    if (updatedTodos.length === 0) {
      return NextResponse.json(
        { success: false, error: '未找到对应的待办任务' },
        { status: 404 }
      );
    }

    console.log('[Agent A Todos API] 处理成功');

    return NextResponse.json({
      success: true,
      data: {
        todo: updatedTodos[0],
      },
    });
  } catch (error) {
    console.error('[Agent A Todos API] 处理失败:', error);
    return NextResponse.json(
      { success: false, error: `处理失败: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
