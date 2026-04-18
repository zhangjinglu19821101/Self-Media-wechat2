/**
 * GET /api/test/insurance-d-order1
 * 查询 insurance-d orderIndex=1 的任务详情
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, dailyTask, agentSubTasksStepHistory, agentSubTasksMcpExecutions } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 查询 insurance-d orderIndex=1 任务详情...');

    // 1. 查询 insurance-d orderIndex=1 的任务
    const subTasks = await db.query.agentSubTasks.findMany({
      where: and(
        eq(agentSubTasks.fromParentsExecutor, 'insurance-d'),
        eq(agentSubTasks.orderIndex, 1)
      ),
    });

    console.log(`📋 找到 ${subTasks.length} 条 insurance-d orderIndex=1 任务`);

    if (subTasks.length === 0) {
      return NextResponse.json({
        success: true,
        message: '未找到 insurance-d 且 orderIndex=1 的任务',
        data: null,
      });
    }

    const subTask = subTasks[0];
    console.log('✅ 找到任务:', {
      id: subTask.id,
      taskTitle: subTask.taskTitle,
      taskDescription: subTask.taskDescription,
      status: subTask.status,
      commandResultId: subTask.commandResultId,
      orderIndex: subTask.orderIndex,
      executionResult: subTask.executionResult,
    });

    // 2. 查询关联的 daily_task
    let relatedDailyTask = null;
    if (subTask.commandResultId) {
      const relatedTasks = await db
        .select()
        .from(dailyTask)
        .where(eq(dailyTask.id, subTask.commandResultId))
        .limit(1);
      
      relatedDailyTask = relatedTasks.length > 0 ? relatedTasks[0] : null;
      console.log('📅 关联的 daily_task:', {
        id: relatedDailyTask?.id,
        taskTitle: relatedDailyTask?.taskTitle,
        taskDescription: relatedDailyTask?.taskDescription,
        taskPrompt: relatedDailyTask?.taskPrompt,
      });
    }

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
    const mcpExecutions = await db
      .select()
      .from(agentSubTasksMcpExecutions)
      .where(
        and(
          eq(agentSubTasksMcpExecutions.commandResultId, subTask.commandResultId),
          eq(agentSubTasksMcpExecutions.orderIndex, subTask.orderIndex)
        )
      )
      .orderBy(desc(agentSubTasksMcpExecutions.attemptTimestamp));

    console.log(`🔧 查询到 ${mcpExecutions.length} 条 MCP 执行记录`);

    // 5. 分析失败原因
    let analysis = {
      taskStatus: subTask.status,
      taskTitle: subTask.taskTitle,
      taskDescription: subTask.taskDescription,
      dailyTaskPrompt: relatedDailyTask?.taskPrompt || '',
      dailyTaskDescription: relatedDailyTask?.taskDescription || '',
      executionResult: subTask.executionResult,
      stepHistoryCount: stepHistory.length,
      mcpExecutionsCount: mcpExecutions.length,
      firstStepHistory: stepHistory[0]?.interactContent || null,
      firstMcpExecution: mcpExecutions[0] ? {
        toolName: mcpExecutions[0].toolName,
        actionName: mcpExecutions[0].actionName,
        resultStatus: mcpExecutions[0].resultStatus,
        errorMessage: mcpExecutions[0].errorMessage,
        reasoning: mcpExecutions[0].reasoning,
      } : null,
    };

    console.log('🔍 任务分析:', analysis);

    return NextResponse.json({
      success: true,
      data: {
        subTask,
        relatedDailyTask,
        stepHistory,
        mcpExecutions,
        analysis,
      },
    });
  } catch (error) {
    console.error('❌ 查询失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '查询失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
