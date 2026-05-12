/**
 * GET /api/test/insurance-d-task
 * 测试查询 insurance-d 任务数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, dailyTask, agentSubTasksStepHistory, agentSubTasksMcpExecutions } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 查询 insurance-d 任务数据...');

    // 1. 查询 from_parents_executor = 'insurance-d' 且 order_index = 1 的任务
    const subTasks = await db.query.agentSubTasks.findMany({
      where: and(
        eq(agentSubTasks.fromParentsExecutor, 'insurance-d'),
        eq(agentSubTasks.orderIndex, 1)
      ),
    });

    console.log(`📋 找到 ${subTasks.length} 条 insurance-d 任务`);

    if (subTasks.length === 0) {
      return NextResponse.json({
        success: true,
        message: '未找到 insurance-d 且 order_index=1 的任务',
        data: null,
      });
    }

    const subTask = subTasks[0];
    console.log('✅ 找到任务详情:', {
      id: subTask.id,
      taskTitle: subTask.taskTitle,
      taskDescription: subTask.taskDescription,
      status: subTask.status,
      commandResultId: subTask.commandResultId,
      orderIndex: subTask.orderIndex,
      fromParentsExecutor: subTask.fromParentsExecutor,
      metadata: subTask.metadata,
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
      console.log('📅 关联的 daily_task:', relatedDailyTask);
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

    // 5. 提取提示词信息
    const promptInfo = {
      taskTitle: subTask.taskTitle,
      taskDescription: subTask.taskDescription,
      metadata: subTask.metadata,
      acceptanceCriteria: subTask.metadata?.acceptanceCriteria || '',
      dailyTaskPrompt: relatedDailyTask?.taskPrompt || '',
      dailyTaskDescription: relatedDailyTask?.taskDescription || '',
    };

    console.log('📝 提示词信息:', promptInfo);

    // 6. 分析失败原因
    let failureAnalysis = null;
    if (subTask.status === 'failed' || stepHistory.length > 0) {
      const lastStep = stepHistory[stepHistory.length - 1];
      const lastMcp = mcpExecutions[0];
      
      failureAnalysis = {
        taskStatus: subTask.status,
        executionResult: subTask.executionResult,
        lastStepContent: lastStep?.interactContent,
        lastMcpError: lastMcp?.errorMessage,
        lastMcpStatus: lastMcp?.resultStatus,
      };
      
      console.log('❌ 失败分析:', failureAnalysis);
    }

    return NextResponse.json({
      success: true,
      data: {
        subTask,
        relatedDailyTask,
        stepHistory,
        mcpExecutions,
        promptInfo,
        failureAnalysis,
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
