/**
 * GET /api/agents/tasks/[taskId]/detail
 * 获取任务详情（包含历史记录和 MCP 执行记录）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, dailyTask, agentSubTasksStepHistory } from '@/lib/db/schema';
import { agentSubTasksMcpExecutions } from '@/lib/db/schema/agent-sub-tasks-mcp-executions';
import { eq, and, desc, lt } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';
// 🔥🔥🔥 新增：导入平台渲染数据提取器
import { extractPlatformRenderData } from '@/lib/platform-render/extractors';
// 🔥🔥🔥 新增：导入 agent-registry 工具函数
import { isWritingAgent, getPlatformForExecutor } from '@/lib/agents/agent-registry';

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

    // 3. 查询交互历史记录（排除系统自动执行的 "auto" 记录，仅保留真实 Agent 执行记录）
    const stepHistory = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, subTask.commandResultId),
          eq(agentSubTasksStepHistory.stepNo, subTask.orderIndex)
        )
      )
      .orderBy(agentSubTasksStepHistory.interactTime)
      .then(records => records.filter(r => r.interactUser !== 'auto'));

    console.log(`📜 查询到 ${stepHistory.length} 条交互历史记录（已排除 auto 记录）`);

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

    // 🔥🔥🔥 5.6 如果当前任务没有文章内容，从 order_index-1 的任务获取
    // 🔥🔥🔥 【架构改造】同时提取 platformRenderData
    let articleContent = subTask.resultText || '';
    let articleTitle = subTask.taskTitle;
    let platformRenderData = null;
    let platform = subTask.metadata?.platform || '';
    
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
    
    // 🔥🔥🔥 5.7 提取 platformRenderData（供前端渲染平台专属UI）
    // 策略：
    // 1. 当前任务是写作任务 → 直接从 resultData 提取
    // 2. 当前任务是预览/合规等节点 → 从同组写作任务提取
    const executor = subTask.fromParentsExecutor;
    const isWritingTask = isWritingAgent(executor);
    
    console.log(`[TaskDetail] 提取 platformRenderData:`, {
      taskId: subTask.id,
      executor,
      isWritingTask,
      orderIndex: subTask.orderIndex,
    });
    
    // 优先从当前任务的 resultData 提取
    if (isWritingTask && subTask.resultData) {
      const platformType = getPlatformForExecutor(executor);
      if (platformType) {
        try {
          const taskMetadata = typeof subTask.metadata === 'object' && subTask.metadata !== null
            ? subTask.metadata as Record<string, unknown>
            : {};
          platformRenderData = extractPlatformRenderData(platformType, subTask.resultData, taskMetadata);
          console.log(`[TaskDetail] ✅ 从当前任务提取 platformRenderData:`, {
            hasData: !!platformRenderData,
            keys: platformRenderData ? Object.keys(platformRenderData) : [],
            cardsCount: platformRenderData && 'cards' in platformRenderData 
              ? (platformRenderData.cards as unknown[])?.length 
              : 0,
          });
        } catch (extractErr) {
          console.warn(`[TaskDetail] ⚠️ 提取 platformRenderData 失败:`, extractErr);
        }
      }
    }
    
    // 如果当前任务没有 resultData，尝试从同组写作任务获取
    if (!platformRenderData && !isWritingTask) {
      try {
        // 查找同组的写作任务
        // 🔥🔥🔥 P1-2 修复：添加 workspaceId 隔离，防止跨租户数据泄露
        const allTasks = await db
          .select()
          .from(agentSubTasks)
          .where(
            and(
              eq(agentSubTasks.commandResultId, subTask.commandResultId),
              eq(agentSubTasks.workspaceId, workspaceId),  // 强制 workspace 隔离
              lt(agentSubTasks.orderIndex, subTask.orderIndex)
            )
          )
          .orderBy(desc(agentSubTasks.orderIndex));
        
        const writingTask = allTasks.find(t => isWritingAgent(t.fromParentsExecutor));
        
        if (writingTask && writingTask.resultData) {
          const platformType = getPlatformForExecutor(writingTask.fromParentsExecutor);
          if (platformType) {
            try {
              const taskMetadata = typeof subTask.metadata === 'object' && subTask.metadata !== null
                ? subTask.metadata as Record<string, unknown>
                : {};
              platformRenderData = extractPlatformRenderData(platformType, writingTask.resultData, taskMetadata);
              console.log(`[TaskDetail] ✅ 从同组写作任务提取 platformRenderData:`, {
                writingTaskId: writingTask.id,
                hasData: !!platformRenderData,
                keys: platformRenderData ? Object.keys(platformRenderData) : [],
              });
            } catch (extractErr) {
              console.warn(`[TaskDetail] ⚠️ 从同组写作任务提取 platformRenderData 失败:`, extractErr);
            }
          }
        }
      } catch (err) {
        console.warn(`[TaskDetail] ⚠️ 查找同组写作任务失败:`, err);
      }
    }

    // 🔥 6. 构建返回数据
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
      // 🔥 【Step4 新增】用户原始指令和创作引导（前端分离展示）
      userOpinion: (subTask as any).userOpinion || null,
      originalInstruction: (subTask as any).originalInstruction || null,
      // 🔴 Phase 4/5: 返回 resultData（含 validationResult / emotionClassification / styleConsistency）
      resultData: subTask.resultData ? (
        typeof subTask.resultData === 'string' ? JSON.parse(subTask.resultData) : subTask.resultData
      ) : null,
      // 🔥🔥🔥 【架构改造】返回 platformRenderData（供前端渲染平台专属UI）
      platformRenderData,
      platform,
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
