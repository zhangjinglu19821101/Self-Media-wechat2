/**
 * 直接测试工程代码：Step 5 to Step 9
 * 
 * 直接调用 SubtaskExecutionEngine 的 public 方法
 * 每个步骤都打印入口参数和出口结果
 * 
 * 使用方法:
 * curl -X POST http://localhost:5000/api/test/step5-to-step9
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  agentSubTasks,
  capabilityList,
  dailyTask,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { SubtaskExecutionEngine } from '@/lib/services/subtask-execution-engine';

export const maxDuration = 120;

// 类型定义
interface ExecutorAgentResult {
  isNeedMcp: boolean;
  problem?: string;
  capabilityType?: string;
  executionResult?: any;
  isTaskDown: boolean;
}

interface AgentBOutput {
  solutionNum: number;
  [key: string]: any;
  mcpExecutionStatus?: string;
  isNotifyAgentA: boolean;
}

export async function POST() {
  console.log('🧪 ========== 开始直接测试工程代码：Step 5 to Step 9 ==========');
  console.log('📋 目标：直接调用 SubtaskExecutionEngine 的 public 方法');
  console.log('📋 要求：每个步骤都打印入口参数和出口结果');

  const testLog: any[] = [];
  const engine = new SubtaskExecutionEngine();

  try {
    // ==========================================
    // 前置准备：创建测试数据
    // ==========================================
    console.log('\n========== 🔧 步骤 0：前置准备 ==========');

    // 1. 查找一个现有的 daily_task
    console.log('\n--- [Step 0.1] 查找 daily_task ---');
    console.log('📥 [Step 0.1][入口参数] 查找 daily_task，无参数');
    
    const existingDailyTask = await db.select().from(dailyTask).limit(1);
    
    if (existingDailyTask.length === 0) {
      console.log('❌ [Step 0.1][失败] 没有找到 daily_task');
      return NextResponse.json({
        success: false,
        message: '没有找到 daily_task，请先创建测试数据',
      });
    }

    const dailyTask = existingDailyTask[0];
    console.log('📤 [Step 0.1][出口结果] 找到 daily_task:', {
      id: dailyTask.id,
      taskId: dailyTask.taskId,
      executor: dailyTask.executor,
    });
    testLog.push({
      step: '0.1',
      description: '查找 daily_task',
      inputParams: '无参数',
      outputResult: {
        dailyTaskId: dailyTask.id,
        taskId: dailyTask.taskId,
      },
    });

    // 2. 创建测试子任务
    console.log('\n--- [Step 0.2] 创建测试子任务 ---');
    const today = new Date().toISOString().split('T')[0];
    const subTaskInput = {
      commandResultId: dailyTask.id,
      fromParentsExecutor: dailyTask.executor || 'insurance-d',
      taskTitle: '测试：直接调用工程代码 Step 5-9',
      taskDescription: '[Direct Test] 直接调用 SubtaskExecutionEngine 的 public 方法',
      status: 'in_progress',
      orderIndex: 997,
      isDispatched: true,
      startedAt: new Date(),
      timeoutHandlingCount: 0,
      escalated: false,
      executionDate: today,
      dialogueRounds: 0,
      dialogueStatus: 'none',
      metadata: { directTest: true, testStep: '5-to-9' },
    };

    console.log('📥 [Step 0.2][入口参数] 创建 agent_sub_tasks:', subTaskInput);

    const subTask = await db
      .insert(agentSubTasks)
      .values(subTaskInput)
      .returning();

    console.log('📤 [Step 0.2][出口结果] 创建测试子任务成功:', {
      id: subTask[0].id,
      status: subTask[0].status,
    });
    testLog.push({
      step: '0.2',
      description: '创建测试子任务',
      inputParams: subTaskInput,
      outputResult: {
        subTaskId: subTask[0].id,
      },
    });

    // ==========================================
    // 模拟前四步的结果（我们模拟执行 agent 反馈
    // ==========================================
    console.log('\n========== 📥 模拟前四步结果 ==========');
    const mockExecutorResult: ExecutorAgentResult = {
      isNeedMcp: true,
      problem: '需要上传微信公众号文章草稿，缺少平台发布能力',
      capabilityType: 'platform_publish',
      isTaskDown: false,
    };

    console.log('📥 [模拟前四步] 执行 agent 反馈:', mockExecutorResult);
    testLog.push({
      step: 'mock',
      description: '模拟前四步结果',
      mockExecutorResult,
    });

    // ==========================================
    // Step 5 (后半部分 + Step 6：queryCapabilityList + callAgentB
    // ==========================================
    console.log('\n========== 🔍 Step 5-6：调用 queryCapabilityList + callAgentB ==========');

    // Step 5.1：queryCapabilityList
    console.log('\n--- [Step 5.1] queryCapabilityList ---');
    const queryInput = {
      capabilityType: mockExecutorResult.capabilityType,
    };
    console.log('📥 [Step 5.1][入口参数] engine.queryCapabilityList:', queryInput);

    const capabilities = await engine.queryCapabilityList(queryInput.capabilityType);
    console.log('📤 [Step 5.1][出口结果] 找到', capabilities.length, '个可用能力');
    console.log('📋 能力列表:', capabilities.map((c: any) => ({
      id: c.id,
      functionDesc: c.functionDesc,
      toolName: c.toolName,
      actionName: c.actionName,
    })));

    testLog.push({
      step: '5.1',
      description: '调用 queryCapabilityList',
      inputParams: queryInput,
      outputResult: {
        capabilityCount: capabilities.length,
        capabilities: capabilities.map((c: any) => ({
          id: c.id,
          functionDesc: c.functionDesc,
        })),
      },
    });

    // Step 5.2 + Step 6：callAgentB
    console.log('\n--- [Step 5.2 + Step 6] callAgentB ---');
    const callAgentBInput = {
      task: subTask[0],
      executorResult: mockExecutorResult,
      capabilities,
    };
    console.log('📥 [Step 5.2 + Step 6][入口参数] engine.callAgentB:', {
      taskId: subTask[0].id,
      executorResult: mockExecutorResult,
      capabilityCount: capabilities.length,
    });

    const agentBOutput = await engine.callAgentB(
      callAgentBInput.task,
      callAgentBInput.executorResult,
      callAgentBInput.capabilities
    );

    console.log('📤 [Step 5.2 + Step 6][出口结果] Agent B 返回:', agentBOutput);
    testLog.push({
      step: '5.2+6',
      description: '调用 callAgentB',
      inputParams: callAgentBInput,
      outputResult: agentBOutput,
    });

    // ==========================================
    // Step 7：executeCapability
    // ==========================================
    console.log('\n========== ⚡ Step 7：executeCapability ==========');
    const executeCapabilityInput = {
      task: subTask[0],
      agentBOutput,
    };
    console.log('📥 [Step 7][入口参数] engine.executeCapability:', {
      taskId: subTask[0].id,
      solutionNum: agentBOutput.solutionNum,
    });

    const mcpResult = await engine.executeCapability(
      executeCapabilityInput.task,
      executeCapabilityInput.agentBOutput
    );

    console.log('📤 [Step 7][出口结果] MCP 执行结果:', mcpResult);
    testLog.push({
      step: '7',
      description: '调用 executeCapability',
      inputParams: executeCapabilityInput,
      outputResult: mcpResult,
    });

    // ==========================================
    // Step 8：sendBackToExecutor
    // ==========================================
    console.log('\n========== 📤 Step 8：sendBackToExecutor ==========');
    const sendBackInput = {
      task: subTask[0],
      executorResult: mockExecutorResult,
      agentBOutput,
      mcpResult,
    };
    console.log('📥 [Step 8][入口参数] engine.sendBackToExecutor:', {
      taskId: subTask[0].id,
    });

    const sendBackResult = await engine.sendBackToExecutor(
      sendBackInput.task,
      sendBackInput.executorResult,
      sendBackInput.agentBOutput,
      sendBackInput.mcpResult
    );

    console.log('📤 [Step 8][出口结果] 返回给执行 agent:', sendBackResult);
    testLog.push({
      step: '8',
      description: '调用 sendBackToExecutor',
      inputParams: sendBackInput,
      outputResult: sendBackResult,
    });

    // ==========================================
    // Step 9：markTaskCompleted
    // ==========================================
    console.log('\n========== 💾 Step 9：markTaskCompleted ==========');
    const markCompletedInput = {
      task: subTask[0],
      result: sendBackResult,
    };
    console.log('📥 [Step 9][入口参数] engine.markTaskCompleted:', {
      taskId: subTask[0].id,
    });

    await engine.markTaskCompleted(
      markCompletedInput.task,
      markCompletedInput.result
    );

    console.log('📤 [Step 9][出口结果] 任务已标记为完成');
    testLog.push({
      step: '9',
      description: '调用 markTaskCompleted',
      inputParams: markCompletedInput,
      outputResult: '任务已标记为完成',
    });

    // ==========================================
    // 返回测试结果
    // ==========================================
    console.log('\n🎉 ========== 测试完成 ==========');

    return NextResponse.json({
      success: true,
      message: 'Step 5 to Step 9 直接测试工程代码完成',
      data: {
        testLog,
        summary: {
          step5_1: '✅ 完成 - queryCapabilityList',
          step5_2_6: '✅ 完成 - callAgentB',
          step7: mcpResult?.success ? '✅ 完成 - executeCapability' : '❌ 失败 - executeCapability',
          step8: '✅ 完成 - sendBackToExecutor',
          step9: '✅ 完成 - markTaskCompleted',
        },
      },
    });

  } catch (error) {
    console.error('❌ 测试失败:', error);
    testLog.push({
      step: 'error',
      description: '测试失败',
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        message: 'Step 5 to Step 9 直接测试工程代码失败',
        error: error instanceof Error ? error.message : String(error),
        testLog,
      },
      { status: 500 }
    );
  }
}
