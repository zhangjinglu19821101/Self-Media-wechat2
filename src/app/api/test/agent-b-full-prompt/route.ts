/**
 * 测试 Agent B 完整提示词（包含 decisionBasis 格式）
 * GET /api/test/agent-b-full-prompt
 */
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { callLLM } from '@/lib/agent-llm';

// 导入我们修改的完整提示词
import {
  AGENT_B_BUSINESS_CONTROLLER_SYSTEM_PROMPT,
  buildAgentBBusinessControllerUserPrompt
} from '@/lib/agents/prompts/agent-b-business-controller';

export async function GET() {
  try {
    console.log('[TestFullPrompt] 开始测试 Agent B 完整提示词...');

    // 1. 查找一个合适的任务
    const tasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.orderIndex, 4));

    if (tasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: '找不到任务'
      }, { status: 404 });
    }

    const task = tasks[0];
    console.log('[TestFullPrompt] 找到任务:', {
      id: task.id,
      taskTitle: task.taskTitle,
      status: task.status,
      fromParentsExecutor: task.fromParentsExecutor,
      commandResultId: task.commandResultId
    });

    // 🔴🔴🔴 新增：查询同一主任务下的所有子任务，判断当前任务是否是最后一个
    let isLastTask = false;
    let allSiblingTasks: any[] = [];
    try {
      allSiblingTasks = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.commandResultId, task.commandResultId));
      
      if (allSiblingTasks.length > 0) {
        const maxOrderIndex = Math.max(...allSiblingTasks.map(t => t.orderIndex));
        isLastTask = task.orderIndex === maxOrderIndex;
        console.log('[TestFullPrompt] 🔴 子任务顺序信息:', {
          currentOrderIndex: task.orderIndex,
          maxOrderIndex,
          isLastTask,
          totalSiblingTasks: allSiblingTasks.length,
          siblingOrderIndexes: allSiblingTasks.map(t => t.orderIndex).sort((a, b) => a - b)
        });
      }
    } catch (error) {
      console.warn('[TestFullPrompt] ⚠️ 查询子任务顺序失败:', error);
    }

    // 2. 构建测试数据
    const testExecutionContext = {
      taskMeta: {
        taskId: task.id,
        iterationCount: 1,
        maxIterations: 5,
        taskTitle: task.taskTitle || '未知任务'
      },
      executorFeedback: {
        originalTask: task.taskDescription || task.taskTitle || '未知任务',
        problem: '测试问题',
        suggestedApproach: '测试方案',
        isNeedMcp: false,
        isTaskDown: true,
        executorOutput: {
          result: '[执行结论]文章已完成公众号格式适配，已保存至草稿箱',
          output: task.resultText || '测试输出内容',
          suggestions: '无',
          reasoning: '任务已完成'
        }
      },
      mcpExecutionHistory: [],
      userFeedback: [],
      priorStepOutput: task.resultText || ''
    };

    const testCapabilities = [];
    const capabilitiesText = '暂无可用能力';
    const mcpHistoryText = '';
    const userFeedbackText = '';
    const executorOutputText = '';
    const priorStepOutputText = task.resultText || '';
    const defaultAccountId = 'insurance-test-account';

    // 3. 使用我们的完整提示词构建函数
    console.log('[TestFullPrompt] 构建完整提示词...');
    const userPrompt = buildAgentBBusinessControllerUserPrompt(
      {
        id: task.id,
        taskTitle: task.taskTitle || '未知任务',
        taskDescription: task.taskDescription || '',
        orderIndex: task.orderIndex || 4,
        fromParentsExecutor: task.fromParentsExecutor || 'insurance-c'
      },
      testExecutionContext,
      capabilitiesText,
      mcpHistoryText,
      userFeedbackText,
      executorOutputText,
      priorStepOutputText,
      defaultAccountId,
      '',  // executorIdentityText
      '',  // reexecuteHistoryText
      isLastTask  // 🔴 传入是否是最后一个任务
    );

    console.log('[TestFullPrompt] 系统提示词长度:', AGENT_B_BUSINESS_CONTROLLER_SYSTEM_PROMPT.length);
    console.log('[TestFullPrompt] 用户提示词长度:', userPrompt.length);

    // 4. 调用 LLM（使用我们的完整系统提示词）
    console.log('[TestFullPrompt] 开始调用 LLM...');
    const llmResponse = await callLLM(
      'agent B',
      '完整提示词测试 - decisionBasis 格式验证',
      AGENT_B_BUSINESS_CONTROLLER_SYSTEM_PROMPT,
      userPrompt,
      { timeout: 180000 }
    );

    console.log('[TestFullPrompt] LLM 响应长度:', llmResponse.length);
    console.log('[TestFullPrompt] LLM 完整响应:', llmResponse);

    return NextResponse.json({
      success: true,
      data: {
        taskId: task.id,
        taskTitle: task.taskTitle,
        fromParentsExecutor: task.fromParentsExecutor,
        commandResultId: task.commandResultId,
        orderIndex: task.orderIndex,
        isLastTask,  // 🔴 返回是否是最后一个任务
        siblingTasksCount: allSiblingTasks.length,
        maxOrderIndex: allSiblingTasks.length > 0 ? Math.max(...allSiblingTasks.map(t => t.orderIndex)) : null,
        systemPromptLength: AGENT_B_BUSINESS_CONTROLLER_SYSTEM_PROMPT.length,
        userPromptLength: userPrompt.length,
        llmResponseLength: llmResponse.length,
        llmResponse: llmResponse,
        userPromptPreview: userPrompt.substring(0, 1000) + '...'
      }
    });

  } catch (error) {
    console.error('[TestFullPrompt] 失败:', error);

    return NextResponse.json({
      success: false,
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
