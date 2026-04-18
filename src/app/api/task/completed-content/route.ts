/**
 * 查询并展示已完成任务的内容
 * 用于查看 order_index=1, status='completed' 的任务完成详情
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { searchParams } = new URL(request.url);
    const orderIndex = parseInt(searchParams.get('orderIndex') || '1');
    
    console.log(`[Completed Content] 查询 order_index=${orderIndex} 的已完成任务`);

    // 1. 查询该 order_index 下所有已完成的任务
    const completedTasks = await db
      .select()
      .from(agentSubTasks)
      .where(
        and(
          eq(agentSubTasks.orderIndex, orderIndex),
          eq(agentSubTasks.status, 'completed')
        )
      )
      .limit(5); // 限制返回最多 5 个任务

    console.log(`[Completed Content] 找到 ${completedTasks.length} 个已完成任务`);

    if (completedTasks.length === 0) {
      return NextResponse.json({
        success: true,
        message: `没有找到 order_index=${orderIndex} 且 status='completed' 的任务`,
        data: null
      });
    }

    // 2. 为每个任务查询交互历史
    const tasksWithHistory = await Promise.all(
      completedTasks.map(async (task) => {
        const history = await db
          .select()
          .from(agentSubTasksStepHistory)
          .where(
            and(
              eq(agentSubTasksStepHistory.commandResultId, task.commandResultId),
              eq(agentSubTasksStepHistory.stepNo, task.orderIndex)
            )
          )
          .orderBy(
            agentSubTasksStepHistory.interactNum,
            agentSubTasksStepHistory.interactTime
          );

        // 解析执行结果
        let executionResult = null;
        try {
          if (task.executionResult) {
            executionResult = JSON.parse(task.executionResult);
          }
        } catch (e) {
          executionResult = { raw: task.executionResult };
        }

        return {
          task: {
            id: task.id,
            commandResultId: task.commandResultId,
            orderIndex: task.orderIndex,
            taskTitle: task.taskTitle,
            taskDescription: task.taskDescription,
            status: task.status,
            fromParentsExecutor: task.fromParentsExecutor,
            startedAt: task.startedAt,
            completedAt: task.completedAt,
            executionResult,
            metadata: task.metadata,
            articleMetadata: task.articleMetadata
          },
          history: history.map(h => ({
            id: h.id,
            stepNo: h.stepNo,
            interactNum: h.interactNum,
            interactType: h.interactType,
            interactUser: h.interactUser,
            interactTime: h.interactTime,
            interactContent: h.interactContent
          }))
        };
      })
    );

    // 3. 格式化展示数据
    const formattedResult = tasksWithHistory.map((item, index) => {
      const { task, history } = item;
      
      // 找到最终的 response 记录
      const finalResponse = history.find(
        h => h.interactType === 'response' && 
             (h.interactContent as any)?.response?.decision?.type === 'COMPLETE'
      );

      // 提取 MCP 尝试记录
      const mcpAttempts = finalResponse?.interactContent 
        ? (finalResponse.interactContent as any)?.response?.mcp_attempts || []
        : [];

      // 提取执行摘要
      const executionSummary = finalResponse?.interactContent
        ? (finalResponse.interactContent as any)?.response?.execution_summary
        : null;

      return {
        index: index + 1,
        taskId: task.id,
        taskTitle: task.taskTitle,
        executor: task.fromParentsExecutor,
        completedAt: task.completedAt,
        executionResult: task.executionResult,
        mcpAttemptsCount: mcpAttempts.length,
        mcpAttempts: mcpAttempts.map((attempt: any) => ({
          attemptNumber: attempt.attemptNumber,
          toolName: attempt.decision?.toolName,
          actionName: attempt.decision?.actionName,
          status: attempt.result?.status,
          success: attempt.result?.data?.success,
          error: attempt.result?.data?.error
        })),
        executionSummary,
        totalHistoryRecords: history.length,
        // 完整的原始数据（可选显示）
        _raw: {
          task,
          history
        }
      };
    });

    return NextResponse.json({
      success: true,
      message: `找到 ${formattedResult.length} 个已完成任务`,
      data: {
        totalCount: formattedResult.length,
        tasks: formattedResult
      }
    });

  } catch (error) {
    console.error('[Completed Content] 查询失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '查询失败',
      },
      { status: 500 }
    );
  }
}
