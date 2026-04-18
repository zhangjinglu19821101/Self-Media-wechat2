/**
 * GET /api/agents/tasks/[taskId]/detail
 * 获取任务详情（包含历史记录和 MCP 执行记录）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, dailyTask, agentSubTasksStepHistory } from '@/lib/db/schema';
import { agentSubTasksMcpExecutions } from '@/lib/db/schema/agent-sub-tasks-mcp-executions';
import { eq, and, desc } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const workspaceId = await getWorkspaceId(request);
    console.log(`📋 获取任务详情，任务ID: ${taskId} (workspace: ${workspaceId})`);

    // 1. 查询子任务信息（含 workspace 隔离）
    const subTask = await db.query.agentSubTasks.findFirst({
      where: and(eq(agentSubTasks.id, taskId), eq(agentSubTasks.workspaceId, workspaceId)),
    });

    if (!subTask) {
      console.log(`❌ 未找到任务，任务ID: ${taskId}`);
      return NextResponse.json(
        { success: false, error: '未找到任务' },
        { status: 404 }
      );
    }

    console.log(`✅ 找到任务:`, {
      id: subTask.id,
      commandResultId: subTask.commandResultId,
      orderIndex: subTask.orderIndex,
      status: subTask.status,
    });

    // 2. 查询关联的 daily_task
    const relatedTasks = await db
      .select()
      .from(dailyTask)
      .where(eq(dailyTask.id, subTask.commandResultId))
      .limit(1);

    const relatedDailyTask = relatedTasks.length > 0 ? relatedTasks[0] : null;

    // 3. 查询交互历史记录
    const stepHistory = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, subTask.commandResultId),
          eq(agentSubTasksStepHistory.stepNo, subTask.orderIndex)
        )
      )
      .orderBy(agentSubTasksStepHistory.interactTime);

    console.log(`📜 查询到 ${stepHistory.length} 条交互历史记录`);

    // 4. 查询 MCP 执行记录
    // 使用 commandResultId 和 orderIndex 查询
    let mcpExecutions: any[] = [];
    try {
      mcpExecutions = await db
        .select({
          id: agentSubTasksMcpExecutions.id,
          attemptId: agentSubTasksMcpExecutions.attemptId,
          attemptNumber: agentSubTasksMcpExecutions.attemptNumber,
          attemptTimestamp: agentSubTasksMcpExecutions.attemptTimestamp,
          solutionNum: agentSubTasksMcpExecutions.solutionNum,
          toolName: agentSubTasksMcpExecutions.toolName,
          actionName: agentSubTasksMcpExecutions.actionName,
          reasoning: agentSubTasksMcpExecutions.reasoning,
          strategy: agentSubTasksMcpExecutions.strategy,
          params: agentSubTasksMcpExecutions.params,
          resultStatus: agentSubTasksMcpExecutions.resultStatus,
          resultData: agentSubTasksMcpExecutions.resultData,
          resultText: agentSubTasksMcpExecutions.resultText,
          errorCode: agentSubTasksMcpExecutions.errorCode,
          errorMessage: agentSubTasksMcpExecutions.errorMessage,
          errorType: agentSubTasksMcpExecutions.errorType,
          executionTimeMs: agentSubTasksMcpExecutions.executionTimeMs,
          isRetryable: agentSubTasksMcpExecutions.isRetryable,
          failureType: agentSubTasksMcpExecutions.failureType,
          suggestedNextAction: agentSubTasksMcpExecutions.suggestedNextAction,
          createdAt: agentSubTasksMcpExecutions.createdAt
        })
        .from(agentSubTasksMcpExecutions)
        .where(
          and(
            eq(agentSubTasksMcpExecutions.commandResultId, subTask.commandResultId),
            eq(agentSubTasksMcpExecutions.orderIndex, subTask.orderIndex)
          )
        )
        .orderBy(desc(agentSubTasksMcpExecutions.attemptTimestamp));
    } catch (error) {
      console.warn(`⚠️ 查询 MCP 执行记录失败，返回空数组:`, error);
      mcpExecutions = [];
    }

    console.log(`🔧 查询到 ${mcpExecutions.length} 条 MCP 执行记录`);

    console.log(`🔧 查询到 ${mcpExecutions.length} 条 MCP 执行记录`);

    // 5. 计算进度
    let progress = 0;
    if (subTask.status === 'completed') {
      progress = 100;
    } else if (subTask.status === 'in_progress') {
      progress = 50;
    } else if (subTask.status === 'waiting_user') {
      progress = 25;
    } else if (subTask.status === 'failed') {
      progress = 0;
    }

    // 🔥 5.5 如果当前任务没有文章内容，从 order_index-1 的任务获取
    let articleContent = subTask.resultText || '';
    let articleTitle = subTask.taskTitle;
    
    if (!articleContent && subTask.orderIndex > 1) {
      console.log(`📖 当前任务无内容，尝试从 order_index=${subTask.orderIndex - 1} 获取文章内容...`);
      
      const prevTask = await db.query.agentSubTasks.findFirst({
        where: and(
          eq(agentSubTasks.commandResultId, subTask.commandResultId),
          eq(agentSubTasks.orderIndex, subTask.orderIndex - 1)
        ),
      });
      
      if (prevTask && prevTask.resultText) {
        articleContent = prevTask.resultText;
        articleTitle = prevTask.taskTitle;
        console.log(`✅ 从前置任务获取到文章内容，长度: ${articleContent.length}`);
      }
    }

    // 6. 构建返回数据
    const taskDetail = {
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
      // 🔥 修复：如果没有内容，从 order_index-1 获取
      executionResult: articleContent,
      articleTitle: articleTitle,
      statusProof: subTask.statusProof,
      articleMetadata: subTask.articleMetadata,
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
      // 🔴 Phase 4/5: 返回 resultData（含 validationResult / emotionClassification / styleConsistency）
      resultData: subTask.resultData ? (
        typeof subTask.resultData === 'string' ? JSON.parse(subTask.resultData) : subTask.resultData
      ) : null,
    };

    return NextResponse.json({
      success: true,
      data: {
        task: taskDetail,
        stepHistory,
        mcpExecutions,
      },
    });
  } catch (error) {
    console.error('❌ 获取任务详情失败:', error);
    const errorMessage = error instanceof Error ? error.message : '获取任务详情失败';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        detail: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
