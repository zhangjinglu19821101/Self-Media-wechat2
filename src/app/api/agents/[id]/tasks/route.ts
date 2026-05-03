/**
 * GET /api/agents/[id]/tasks
 * 获取指定 Agent 的任务列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, dailyTask } from '@/lib/db/schema';
import { eq, and, or, desc, exists, ne } from 'drizzle-orm';
import { agentSubTasksStepHistory } from '@/lib/db/schema';
import { getWorkspaceId } from '@/lib/auth/context';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const workspaceId = await getWorkspaceId(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 可选：筛选状态
    const hasInteraction = searchParams.get('hasInteraction'); // 可选：只返回有交互历史的任务

    console.log(`📋 获取 Agent ${agentId} 的任务列表 (workspace: ${workspaceId})`);

    // 构建查询条件
    // 🔥 Agent B 作为集团管理者，可以看到所有 Agent 的任务
    let whereClause;
    
    const conditions = [];
    
    // 🔥 Workspace 隔离
    conditions.push(eq(agentSubTasks.workspaceId, workspaceId));
    
    // 🔥 如果不是 Agent B，则只查询分配给自己的任务
    if (agentId !== 'B') {
      conditions.push(eq(agentSubTasks.fromParentsExecutor, agentId));
    }
    // Agent B 不添加 fromParentsExecutor 条件，可以看到所有任务
    
    if (status) {
      conditions.push(eq(agentSubTasks.status, status));
    }
    
    // 🔥 只返回有交互历史的任务（排除 auto 记录）
    if (hasInteraction === 'true') {
      conditions.push(
        exists(
          db.select({ id: agentSubTasksStepHistory.id })
            .from(agentSubTasksStepHistory)
            .where(
              and(
                eq(agentSubTasksStepHistory.commandResultId, agentSubTasks.commandResultId),
                eq(agentSubTasksStepHistory.stepNo, agentSubTasks.orderIndex),
                ne(agentSubTasksStepHistory.interactUser, 'auto')  // 排除系统自动执行记录
              )
            )
        )
      );
    }
    
    // 根据条件构建 whereClause
    whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    console.log(`🔍 whereClause:`, whereClause);

    // 查询 agent_sub_tasks
    const subTasks = await db
      .select()
      .from(agentSubTasks)
      .where(whereClause || undefined)
      .orderBy(desc(agentSubTasks.createdAt))
      .limit(50);
    
    console.log(`📊 从数据库查询到 ${subTasks.length} 条记录`);

    // 关联查询 daily_task 获取更多信息
    const tasks = [];
    for (const subTask of subTasks) {
      try {
        // 查询关联的 daily_task
        const relatedTasks = await db
          .select()
          .from(dailyTask)
          .where(eq(dailyTask.id, subTask.commandResultId))
          .limit(1);
        
        const relatedDailyTask = relatedTasks.length > 0 ? relatedTasks[0] : null;

        // 🔥 计算进度
        let progress = 0;
        if (subTask.status === 'completed') {
          progress = 100;
        } else if (subTask.status === 'in_progress') {
          progress = 50;
        } else if (subTask.status === 'waiting_user') {
          progress = 25; // 等待用户处理，进度设为 25%
        } else if (subTask.status === 'failed') {
          progress = 0;
        }

        tasks.push({
          id: subTask.id,
          taskTitle: subTask.taskTitle,
          taskDescription: subTask.taskDescription,
          status: subTask.status,
          priority: relatedDailyTask?.taskPriority || 'normal',
          orderIndex: subTask.orderIndex,
          isCritical: subTask.metadata?.isCritical || false,
          executor: subTask.fromParentsExecutor,
          createdAt: subTask.createdAt,
          startedAt: subTask.startedAt,
          completedAt: subTask.completedAt,
          isDispatched: subTask.isDispatched,
          dispatchedAt: subTask.dispatchedAt,
          resultData: subTask.resultData, // 执行结果（JSONB 格式）
          resultText: subTask.resultText, // 执行结果（文本格式）
          statusProof: subTask.statusProof, // 状态证明
          articleMetadata: subTask.articleMetadata, // 文章元数据
          userOpinion: (subTask as any).userOpinion || relatedDailyTask?.userOpinion || null, // 🔥 用户观点（标题回退）
          metadata: {
            ...subTask.metadata,
            acceptanceCriteria: subTask.metadata?.acceptanceCriteria || '',
          },
          relatedDailyTask: relatedDailyTask ? {
            id: relatedDailyTask.id,
            taskId: relatedDailyTask.taskId,
            executionDate: relatedDailyTask.executionDate,
            executionDeadlineStart: relatedDailyTask.executionDeadlineStart,
            executionDeadlineEnd: relatedDailyTask.executionDeadlineEnd,
            deliverables: relatedDailyTask.deliverables,
          } : null,
          progress,
          commandResultId: subTask.commandResultId,
        });
      } catch (error) {
        console.error(`❌ 处理子任务失败:`, error);
      }
    }

    // 🔥 按优先级和执行顺序排序
    tasks.sort((a, b) => {
      // 1. 关键任务优先
      const aIsCritical = a.isCritical;
      const bIsCritical = b.isCritical;
      if (aIsCritical !== bIsCritical) {
        return bIsCritical ? 1 : -1;
      }

      // 2. 执行顺序靠前的优先
      return a.orderIndex - b.orderIndex;
    });

    // 统计任务数量
    const stats = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      waiting_user: tasks.filter(t => t.status === 'waiting_user').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      critical: tasks.filter(t => t.isCritical).length,
    };

    console.log(`✅ 找到 ${tasks.length} 个任务`, stats);

    return NextResponse.json({
      success: true,
      data: {
        tasks,
        stats,
      },
    });
  } catch (error) {
    console.error('❌ 获取任务列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取任务列表失败',
      },
      { status: 500 }
    );
  }
}
