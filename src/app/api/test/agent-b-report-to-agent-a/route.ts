/**
 * Mock 测试：Agent B 上报 Agent A 场景
 * 
 * 场景：
 * 1. insurance-d 收到执行指令：上传公众号文章
 * 2. insurance-d 没有公众号上传文章接口 → 执行失败
 * 3. Agent B 介入
 * 4. Agent B 发现自己也没有上传微信公众号文章的能力
 * 5. Agent B 上报给 Agent A
 * 
 * 使用方法：
 * curl -X POST http://localhost:5000/api/test/agent-b-report-to-agent-a
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, dailyTask, agentSubTasksStepHistory, agentNotifications, agentReports } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { createInitialArticleMetadata } from '@/lib/types/article-metadata';
import { createAgentConsultContent, createAgentResponseContent, createAgentSummaryContent } from '@/lib/types/interact-content';

export const maxDuration = 60;

export async function POST() {
  console.log('[Mock Test] 开始 Agent B 上报 Agent A 场景测试');

  try {
    // 1. 清理之前的测试数据
    console.log('[Mock Test] 清理测试数据...');
    const oldSubTasks = await db.select().from(agentSubTasks).limit(20);
    for (const st of oldSubTasks) {
      await db.delete(agentSubTasks).where(eq(agentSubTasks.id, st.id));
    }

    // 2. 查找一个现有的 daily_task
    const existingDailyTask = await db.select().from(dailyTask).limit(1);
    if (existingDailyTask.length === 0) {
      return NextResponse.json({
        success: false,
        message: '没有找到 daily_task，请先创建测试数据',
      });
    }

    const dailyTask = existingDailyTask[0];
    console.log('[Mock Test] 使用 daily_task:', dailyTask.taskId);

    // 3. 创建测试子任务：上传公众号文章
    console.log('[Mock Test] 创建测试子任务：上传公众号文章...');
    
    const today = new Date().toISOString().split('T')[0];
    const initialMetadata = createInitialArticleMetadata({
      articleTitle: '《年终奖到手，存年金险还是增额寿？》',
      creatorAgent: 'insurance-d',
      taskType: 'article_generation',
      totalSteps: 1,
    });

    const agentSubTask = await db
      .insert(agentSubTasks)
      .values({
        commandResultId: dailyTask.id,
        fromParentsExecutor: dailyTask.executor,
        taskTitle: '上传公众号文章',
        taskDescription: '[Mock] 测试子任务：上传公众号文章到微信公众号',
        status: 'pending',
        orderIndex: 1,
        isDispatched: false,
        timeoutHandlingCount: 0,
        escalated: false,
        executionDate: today,
        dialogueRounds: 0,
        dialogueStatus: 'none',
        articleMetadata: initialMetadata,
        metadata: { mock: true, mock_test: true, scenario: 'agent_b_report_to_agent_a' },
      })
      .returning();

    console.log('[Mock Test] 创建测试子任务成功:', agentSubTask[0].id);

    // 4. 模拟流程
    console.log('[Mock Test] 开始模拟流程...');
    const executionSteps = [];

    // === 步骤 1：insurance-d 执行失败 ===
    console.log('[Mock Test] 步骤 1：insurance-d 执行失败...');
    
    // 更新任务状态为 in_progress
    await db
      .update(agentSubTasks)
      .set({
        status: 'in_progress',
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentSubTasks.id, agentSubTask[0].id));

    // 模拟执行失败（insurance-d 没有公众号上传能力）
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 更新任务状态为 failed
    await db
      .update(agentSubTasks)
      .set({
        status: 'failed',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentSubTasks.id, agentSubTask[0].id));

    executionSteps.push({
      step: 1,
      description: 'insurance-d 执行失败（无公众号上传能力）',
      status: 'completed',
    });

    // === 步骤 2：Agent B 介入并创建交互历史 ===
    console.log('[Mock Test] 步骤 2：Agent B 介入并创建交互历史...');
    
    // 检查是否已存在记录
    const existingHistory = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, agentSubTask[0].commandResultId),
          eq(agentSubTasksStepHistory.stepNo, 1)
        )
      );

    // Agent B 第 1 次介入（第 1 次交互）
    const agentBConsultContent = createAgentConsultContent({
      consultant: 'agent B',
      responder: 'insurance-d',
      question: '你是否有微信公众号上传文章的接口？如果有的话，请使用你的接口将文章上传到公众号。',
      response: '',
      executionResult: {
        status: 'in_progress',
      },
      extInfo: {
        mock: true,
        interaction_round: 1,
        suggestion: '请 insurance-d 确认是否有公众号上传能力',
      },
    });

    if (existingHistory.length === 0) {
      // 插入新记录
      await db.insert(agentSubTasksStepHistory).values({
        commandResultId: agentSubTask[0].commandResultId,
        stepNo: 1,
        interactContent: agentBConsultContent,
        interactUser: 'agent B',
        interactTime: new Date(),
        interactNum: 1,
      });
    } else {
      // 更新现有记录
      await db
        .update(agentSubTasksStepHistory)
        .set({
          interactContent: agentBConsultContent,
          interactUser: 'agent B',
          interactTime: new Date(),
          interactNum: 1,
        })
        .where(eq(agentSubTasksStepHistory.id, existingHistory[0].id));
    }

    executionSteps.push({
      step: 2,
      description: 'Agent B 第 1 次介入，询问 insurance-d 能力',
      status: 'completed',
    });

    // === 步骤 3：insurance-d 回应（第 2 次交互） ===
    console.log('[Mock Test] 步骤 3：insurance-d 回应（第 2 次交互）...');
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const insuranceDResponseContent = createAgentResponseContent({
      consultant: 'insurance-d',
      responder: 'agent B',
      question: '',
      response: '抱歉，我没有配置微信公众号上传文章的接口，无法执行此任务。',
      executionResult: {
        status: 'failed',
        error_msg: '未配置微信公众号上传接口',
      },
      extInfo: {
        mock: true,
        interaction_round: 1,
        suggestion: '建议使用其他有公众号上传能力的 Agent',
      },
    });

    // 重新查询获取最新记录
    const historyAfterFirstUpdate = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, agentSubTask[0].commandResultId),
          eq(agentSubTasksStepHistory.stepNo, 1)
        )
      );

    // 更新为第 2 次交互
    await db
      .update(agentSubTasksStepHistory)
      .set({
        interactContent: insuranceDResponseContent,
        interactUser: 'insurance-d',
        interactTime: new Date(),
        interactNum: 2,
      })
      .where(eq(agentSubTasksStepHistory.id, historyAfterFirstUpdate[0].id));

    executionSteps.push({
      step: 3,
      description: 'insurance-d 回应无上传能力',
      status: 'completed',
    });

    // === 步骤 4：Agent B 总结并上报 Agent A（第 3 次交互） ===
    console.log('[Mock Test] 步骤 4：Agent B 总结并上报 Agent A（第 3 次交互）...');
    
    // Agent B 总结（第 3 次交互）
    const agentBSummaryContent = createAgentSummaryContent({
      consultant: 'agent B',
      responder: 'agent A',
      question: '经过 1 次交互，发现 insurance-d 没有微信公众号上传能力，我也没有这个能力',
      response: 'Agent B 总结：经过沟通确认，insurance-d 没有配置微信公众号上传文章的接口，我也没有这个能力。建议 Agent A 介入处理或调整任务要求。',
      executionResult: {
        status: 'failed',
        error_msg: 'insurance-d 和 Agent B 都没有微信公众号上传能力',
      },
      extInfo: {
        mock: true,
        total_interactions: 2,
        summary: 'Mock 总结：任务执行遇到阻塞，双方都无公众号上传能力，需要人工介入',
        suggestion: '建议：1) 配置微信公众号上传接口；2) 调整任务要求；3) 人工介入处理',
      },
    });

    // 重新查询获取最新记录
    const historyAfterSecondUpdate = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, agentSubTask[0].commandResultId),
          eq(agentSubTasksStepHistory.stepNo, 1)
        )
      );

    // 更新为第 3 次交互
    await db
      .update(agentSubTasksStepHistory)
      .set({
        interactContent: agentBSummaryContent,
        interactUser: 'agent B',
        interactTime: new Date(),
        interactNum: 3,
      })
      .where(eq(agentSubTasksStepHistory.id, historyAfterSecondUpdate[0].id));

    // === 步骤 5：创建 agentReports 记录 ===
    console.log('[Mock Test] 步骤 5：创建 agentReports 记录...');
    
    const agentReport = await db.insert(agentReports).values({
      reportType: 'subtask_timeout',
      commandResultId: dailyTask.id,
      subTaskId: agentSubTask[0].id,
      summary: 'insurance-d 和 Agent B 都没有微信公众号上传能力，任务无法完成',
      conclusion: '经过 1 次交互确认，双方都缺乏所需能力，需要 Agent A 介入',
      dialogueProcess: [
        {
          round: 1,
          sender: 'agent B',
          content: '询问 insurance-d 是否有微信公众号上传文章的能力',
          isUnderstand: true,
          timestamp: new Date().toISOString(),
        },
        {
          round: 2,
          sender: 'insurance-d',
          content: '抱歉，我没有配置微信公众号上传文章的接口，无法执行此任务。',
          isUnderstand: true,
          timestamp: new Date().toISOString(),
        },
      ],
      suggestedActions: [
        {
          action: 'reassign_task',
          description: '重新分配任务给有公众号上传能力的 Agent',
          priority: 'high',
        },
        {
          action: 'adjust_resources',
          description: '配置微信公众号上传接口',
          priority: 'medium',
        },
        {
          action: 'dismiss',
          description: '驳回此任务要求',
          priority: 'low',
        },
      ],
      reportedTo: 'agent_a',
      reportedFrom: 'agent_b',
      status: 'pending',
    }).returning();

    executionSteps.push({
      step: 4,
      description: 'Agent B 总结并上报 Agent A，创建正式报告',
      status: 'completed',
      reportId: agentReport[0].id,
    });

    // === 步骤 6：创建 agentNotifications 记录 ===
    console.log('[Mock Test] 步骤 6：创建 agentNotifications 记录...');
    
    const notificationId = `notify-${uuidv4()}`;
    await db.insert(agentNotifications).values({
      notificationId: notificationId,
      fromAgentId: 'agent_b',
      toAgentId: 'agent_a',
      notificationType: 'report',
      title: '[Mock] 任务执行失败：无微信公众号上传能力',
      content: '经过 1 次交互确认，insurance-d 没有配置微信公众号上传文章的接口，Agent B 也没有这个能力。建议 Agent A 介入处理或调整任务要求。',
      relatedTaskId: dailyTask.taskId,
      status: 'unread',
      priority: 'high',
      metadata: { mock: true, scenario: 'agent_b_report_to_agent_a' },
    });

    executionSteps.push({
      step: 5,
      description: '创建弹框通知',
      status: 'completed',
      notificationId,
    });

    // === 步骤 7：更新 dailyTask ===
    console.log('[Mock Test] 步骤 7：更新 dailyTask...');
    
    await db
      .update(dailyTask)
      .set({
        latestReportId: agentReport[0].id,
        reportCount: sql`report_count + 1`,
        requiresIntervention: true,
        updatedAt: new Date(),
      })
      .where(eq(dailyTask.id, dailyTask.id));

    // 5. 查询最终结果
    const finalSubTask = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, agentSubTask[0].id));

    const stepHistory = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(eq(agentSubTasksStepHistory.commandResultId, agentSubTask[0].commandResultId))
      .orderBy(agentSubTasksStepHistory.interactNum);

    console.log('[Mock Test] 测试完成');

    return NextResponse.json({
      success: true,
      message: 'Agent B 上报 Agent A 场景测试完成',
      data: {
        subTask: finalSubTask[0],
        stepHistory: stepHistory,
        agentReport: agentReport[0],
        notificationId,
        executionSteps,
      },
    });
  } catch (error) {
    console.error('[Mock Test] 测试失败:', error);
    return NextResponse.json(
      { success: false, error: `Error: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
