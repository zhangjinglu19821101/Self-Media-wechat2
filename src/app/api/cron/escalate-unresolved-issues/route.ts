/**
 * POST /api/cron/escalate-unresolved-issues
 * 定时任务：上报未解决的问题给 agent A
 *
 * 功能：
 * 1. 查询处理 5 轮仍未解决的问题
 * 2. 调用 agent B 生成沟通概要
 * 3. 标记为 escalated
 * 4. 上报给 agent A
 *
 * 调用方式：
 * - 每 10 分钟自动执行一次
 * - 或手动触发执行
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, dailyTask } from '@/lib/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { createNotification } from '@/lib/services/notification-service';
import { getLLMClient } from '@/lib/agent-llm';

// 配置参数
const MAX_HANDLING_COUNT = 5; // 最大处理次数
const MAX_ESCALATE_TASKS = 5; // 每次最多上报 5 个任务

/**
 * POST /api/cron/escalate-unresolved-issues
 * 上报未解决的问题给 agent A
 */
export async function POST(request: NextRequest) {
  console.log('🔄 [escalate-unresolved-issues] 开始上报未解决问题...');

  try {
    // Step 1: 查询需要上报的任务
    // 条件：
    // 1. status = 'timeout'
    // 2. timeout_handling_count >= 5
    // 3. escalated = false
    const tasks = await db
      .select()
      .from(agentSubTasks)
      .where(
        and(
          eq(agentSubTasks.status, 'timeout'),
          isNotNull(agentSubTasks.feedbackHistory)
        )
      );

    // 在内存中过滤出需要上报的任务
    const tasksToEscalate = tasks.filter(task => {
      const handlingCount = task.timeoutHandlingCount || 0;
      return handlingCount >= MAX_HANDLING_COUNT && !task.escalated;
    });

    console.log(`📋 找到 ${tasksToEscalate.length} 个需要上报的任务`);

    if (tasksToEscalate.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有需要上报的任务',
        escalatedCount: 0,
      });
    }

    // 最多上报 5 个任务
    const tasksToProcess = tasksToEscalate.slice(0, MAX_ESCALATE_TASKS);
    console.log(`📊 上报前 ${tasksToProcess.length} 个任务`);

    let escalatedCount = 0;
    const results = [];

    // Step 2: 逐个上报任务
    for (const task of tasksToProcess) {
      console.log(`\n⬆️ 上报任务: ${task.taskTitle}`);
      console.log(`  🔄 处理次数: ${task.timeoutHandlingCount}/${MAX_HANDLING_COUNT}`);

      try {
        // Step 2.1: 调用 agent B 生成沟通概要
        const escalatedReason = await generateEscalationReason(task);
        console.log(`  📝 沟通概要: ${escalatedReason}`);

        // Step 2.2: 标记为 escalated
        await db
          .update(agentSubTasks)
          .set({
            status: 'escalated',
            escalated: true,
            escalatedAt: new Date(),
            escalatedReason,
            updatedAt: new Date(),
          })
          .where(eq(agentSubTasks.id, task.id));

        console.log(`  ✅ 任务已标记为 escalated`);

        // Step 2.3: 通知 agent A
        await createNotification({
          agentId: 'A',
          type: 'subtask_escalated',
          taskId: task.id,
          relatedTaskId: task.commandResultId,
          title: `子任务已上报 - 需要 agent A 介入`,
          content: {
            taskTitle: task.taskTitle,
            taskDescription: task.taskDescription,
            executor: task.agentId,
            escalatedReason,
            handlingCount: task.timeoutHandlingCount,
          },
          metadata: {
            subTaskId: task.id,
            commandResultId: task.commandResultId,
            feedbackHistory: task.feedbackHistory,
          },
        });

        console.log(`  ✅ 已通知 agent A`);

        escalatedCount++;
        results.push({
          taskId: task.id,
          taskTitle: task.taskTitle,
          status: 'escalated',
          escalatedReason,
        });
      } catch (error) {
        console.error(`  ❌ 上报失败:`, error);
        results.push({
          taskId: task.id,
          taskTitle: task.taskTitle,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log(`\n✅ 上报完成: ${escalatedCount} 个`);

    return NextResponse.json({
      success: true,
      message: `上报完成: ${escalatedCount} 个`,
      escalatedCount,
      results,
    });
  } catch (error) {
    console.error('❌ 上报失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * 调用 agent B 生成沟通概要
 */
async function generateEscalationReason(task: any): Promise<string> {
  const taskTitle = task.taskTitle || '未命名任务';
  const taskDescription = task.taskDescription || '无描述';
  const feedbackHistory = task.feedbackHistory || [];

  // 提取前 5 条沟通记录
  const recentHistory = feedbackHistory.slice(-5);

  const historyText = recentHistory.map((record: any, index: number) => {
    return `第 ${index + 1} 轮：${record.feedbackBy} 反馈：${record.feedbackContent}，${record.handledBy} 处理：${record.handlingResult}`;
  }).join('\n');

  const prompt = `你是 Agent B，任务管理专家。

【背景】
insurance-d 与执行 Agent 在执行某个任务时遇到问题，已经沟通 5 轮但仍未解决。

【任务信息】
任务标题：${taskTitle}
任务内容：${taskDescription}

【沟通历史】
${historyText}

【你的任务】
请根据以上沟通历史，生成一个简要的沟通概要，上报给 Agent A。

【格式要求】
- 控制在 200 字以内
- 突出关键问题点
- 说明尝试过的解决方案
- 明确需要 Agent A 提供什么帮助

【示例】
"任务【需求分析】执行超时，经 5 轮沟通确认：1)需求文档不完整；2)与后端接口定义不清晰；3)缺少测试用例。insurance-d 已尝试补充文档，但执行 Agent 仍无法继续。需要 Agent A 协调明确需求范围和接口规范。"

请直接输出沟通概要，不要添加任何解释性文字。`;

  try {
    const llmClient = getLLMClient();
    const response = await llmClient.chat.completions.create({
      messages: [
        { role: 'system', content: '你是 Agent B，任务管理专家。' },
        { role: 'user', content: prompt }
      ],
      model: 'deepseek-chat',
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '无法生成沟通概要';
    console.log(`✅ agent B 已生成沟通概要: ${content}`);

    return content.trim();
  } catch (error) {
    console.error('❌ 生成沟通概要失败:', error);
    return `任务【${taskTitle}】执行超时。经 5 轮沟通仍未解决，需要 Agent A 介入处理。`;
  }
}

/**
 * GET /api/cron/escalate-unresolved-issues
 * 获取定时任务说明（可选）
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: '上报未解决问题定时任务 API',
    description: '上报处理 5 轮仍未解决的问题给 agent A',
    config: {
      maxHandlingCount: MAX_HANDLING_COUNT,
      maxEscalateTasks: MAX_ESCALATE_TASKS,
      schedule: '每 10 分钟执行一次',
    },
    queryConditions: {
      status: '= timeout',
      timeoutHandlingCount: '>= 5',
      escalated: '= false',
    },
    workflow: [
      '1. 查询需要上报的任务',
      '2. 调用 agent B 生成沟通概要',
      '3. 标记为 escalated',
      '4. 通知 agent A',
    ],
  });
}
