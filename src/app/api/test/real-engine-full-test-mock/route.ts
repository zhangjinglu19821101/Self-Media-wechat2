/**
 * 真实测试我们的工程逻辑（Mock 版本）
 * 
 * 测试流程：
 * 1. 模拟执行 agent 标准反馈（无法上传微信公众号）
 * 2. 真实调用 callAgentB() - 把信息给 agent B
 * 3. 模拟 MCP 成功返回 - 不调用真实微信 API
 * 4. 继续测试后续步骤（sendBackToExecutor、markTaskCompleted）
 * 
 * 使用方法:
 * curl -X POST http://localhost:5000/api/test/real-engine-full-test-mock
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
  console.log('🧪 ========== 真实测试我们的工程逻辑（Mock 版本）==========');
  console.log('📋 目标：完整测试所有步骤，Mock MCP 调用');

  const testLog: any[] = [];
  const engine = new SubtaskExecutionEngine();

  try {
    // ==========================================
    // 步骤 1：前置准备
    // ==========================================
    console.log('\n========== 🔧 步骤 1：前置准备 ==========');
    
    // 查找一个现有的 daily_task
    const existingDailyTask = await db.select().from(dailyTask).limit(1);
    if (existingDailyTask.length === 0) {
      return NextResponse.json({
        success: false,
        message: '没有找到 daily_task，请先创建测试数据',
      });
    }

    const dailyTask = existingDailyTask[0];
    
    // 创建一个临时的 task 对象（不需要插入数据库）
    const tempTask = {
      id: 'temp-real-test-mock-' + uuidv4(),
      commandResultId: dailyTask.id,
      fromParentsExecutor: dailyTask.executor || 'insurance-d',
      taskTitle: '真实测试：执行 agent 无法上传微信公众号（Mock 版本）',
      taskDescription: '真实测试我们的工程逻辑，Mock MCP 调用',
      status: 'in_progress',
      orderIndex: 995,
      isDispatched: true,
      startedAt: new Date(),
      timeoutHandlingCount: 0,
      escalated: false,
      executionDate: new Date().toISOString().split('T')[0],
      dialogueRounds: 0,
      dialogueStatus: 'none',
      metadata: { realEngineTestMock: true },
    } as any;

    console.log('✅ 前置准备完成:', {
      dailyTaskId: dailyTask.id,
      tempTaskId: tempTask.id,
    });
    testLog.push({
      step: '1',
      description: '前置准备',
      dailyTaskId: dailyTask.id,
      tempTaskId: tempTask.id,
    });

    // ==========================================
    // 步骤 2：模拟执行 agent 标准反馈（无法上传微信公众号）
    // ==========================================
    console.log('\n========== 📥 步骤 2：模拟执行 agent 标准反馈 ==========');
    
    const mockExecutorResult: ExecutorAgentResult = {
      isNeedMcp: true,
      problem: '无法上传微信公众号文章草稿，任务执行阻塞，缺少平台发布能力。待上传文章信息：标题《保险科普：如何选择医疗险》，作者保险事业部，摘要本文详细介绍如何选择适合自己的医疗险，内容<h1>如何选择医疗险</h1><p>医疗险是我们健康保障的重要组成部分...</p>，公众号账号ID：insurance-account',
      capabilityType: 'platform_publish',
      isTaskDown: false,
    };

    console.log('📥 [步骤 2][模拟] 执行 agent 反馈:', mockExecutorResult);
    testLog.push({
      step: '2',
      description: '模拟执行 agent 标准反馈',
      mockExecutorResult,
    });

    // ==========================================
    // 步骤 3：查询 capability_list（真实调用）
    // ==========================================
    console.log('\n========== 🔍 步骤 3：真实调用 queryCapabilityList() ==========');
    
    console.log('📥 [步骤 3][入口参数] 调用 engine.queryCapabilityList():', {
      capabilityType: mockExecutorResult.capabilityType,
    });

    const capabilities = await engine.queryCapabilityList(mockExecutorResult.capabilityType);
    
    console.log('📤 [步骤 3][出口结果] 找到', capabilities.length, '个可用能力');
    console.log('📋 能力列表:', capabilities.map((cap: any) => ({
      id: cap.id,
      functionDesc: cap.functionDesc,
      toolName: cap.toolName,
      actionName: cap.actionName,
    })));

    testLog.push({
      step: '3',
      description: '真实调用 queryCapabilityList()',
      inputParams: { capabilityType: mockExecutorResult.capabilityType },
      outputResult: {
        capabilityCount: capabilities.length,
        capabilities: capabilities.map((c: any) => ({ id: c.id, functionDesc: c.functionDesc })),
      },
    });

    // ==========================================
    // 步骤 4：真实调用 callAgentB()
    // ==========================================
    console.log('\n========== 🤖 步骤 4：真实调用 callAgentB() ==========');
    
    console.log('📥 [步骤 4][入口参数] 调用 engine.callAgentB():', {
      taskId: tempTask.id,
      executorResult: mockExecutorResult,
      capabilityCount: capabilities.length,
    });

    const agentBOutput = await engine.callAgentB(tempTask, mockExecutorResult, capabilities);
    
    console.log('📤 [步骤 4][出口结果] Agent B 输出:', JSON.stringify(agentBOutput, null, 2));

    testLog.push({
      step: '4',
      description: '真实调用 callAgentB()',
      inputParams: { mockExecutorResult, capabilityCount: capabilities.length },
      outputResult: agentBOutput,
    });

    // ==========================================
    // 步骤 5：模拟 MCP 成功返回
    // ==========================================
    console.log('\n========== ⚡ 步骤 5：模拟 MCP 成功返回 ==========');
    
    const mockMcpResult = {
      success: true,
      data: {
        media_id: 'mock_media_id_' + Date.now(),
        create_time: Date.now()
      },
      metadata: {
        tool: (agentBOutput as any).toolName,
        action: (agentBOutput as any).actionName,
        timestamp: Date.now()
      }
    };

    console.log('📤 [步骤 5][Mock] MCP 成功结果:', mockMcpResult);

    const mcpResult = {
      success: true,
      executionMode: 'direct',
      insuranceDAnalysis: {
        isNeedMcp: true,
        problem: tempTask.taskTitle,
        domainScene: '通用场景',
        capabilityType: 'platform_publish',
        creationSuggestion: '根据任务需求调用对应功能描述执行操作',
      },
      agentBParams: {
        apiAddress: `${(agentBOutput as any).toolName}/${(agentBOutput as any).actionName}`,
        params: (agentBOutput as any).params,
        riskTips: '请确保参数符合业务规则',
        capabilityUpgradeSuggestion: '建议积累更多案例优化参数模板',
      },
      mcpResult: mockMcpResult,
      capabilityUpgradeSuggestion: '建议积累更多案例优化参数模板',
    };

    testLog.push({
      step: '5',
      description: '模拟 MCP 成功返回',
      mockMcpResult,
      outputResult: mcpResult,
    });

    // ==========================================
    // 步骤 6：真实调用 sendBackToExecutor()
    // ==========================================
    console.log('\n========== 📤 步骤 6：真实调用 sendBackToExecutor() ==========');
    
    console.log('📥 [步骤 6][入口参数] 调用 engine.sendBackToExecutor():', {
      taskId: tempTask.id,
      executorResult: mockExecutorResult,
      agentBOutput,
      mcpResult,
    });

    const finalResult = await engine.sendBackToExecutor(
      tempTask,
      mockExecutorResult,
      agentBOutput,
      mcpResult
    );

    console.log('📤 [步骤 6][出口结果] 最终结果:', finalResult);

    testLog.push({
      step: '6',
      description: '真实调用 sendBackToExecutor()',
      inputParams: { mockExecutorResult, agentBOutput, mcpResult },
      outputResult: finalResult,
    });

    // ==========================================
    // 步骤 7：真实调用 markTaskCompleted()
    // ==========================================
    console.log('\n========== 💾 步骤 7：真实调用 markTaskCompleted()（模拟） ==========');
    
    console.log('📥 [步骤 7][入口参数] 调用 engine.markTaskCompleted()', {
      taskId: tempTask.id,
      finalResult,
    });

    // 注意：我们不真的更新数据库，只是模拟一下
    console.log('✅ [步骤 7][模拟] 任务已标记为完成');

    testLog.push({
      step: '7',
      description: '模拟 markTaskCompleted()',
      inputParams: { finalResult },
      outputResult: '任务标记为完成（模拟）',
    });

    // ==========================================
    // 返回测试结果
    // ==========================================
    console.log('\n🎉 ========== 真实工程逻辑测试完成（Mock 版本）==========');

    return NextResponse.json({
      success: true,
      message: '真实工程逻辑测试完成（Mock 版本）',
      data: {
        testLog,
        summary: {
          step2: '✅ 完成 - 模拟执行 agent 反馈',
          step3: '✅ 完成 - 真实调用 queryCapabilityList()',
          step4: '✅ 完成 - 真实调用 callAgentB()',
          step5: '✅ 完成 - 模拟 MCP 成功返回',
          step6: '✅ 完成 - 真实调用 sendBackToExecutor()',
          step7: '✅ 完成 - 模拟 markTaskCompleted()',
        },
        keyOutputs: {
          mockExecutorResult,
          agentBOutput,
          mockMcpResult,
          finalResult,
        },
      },
    });

  } catch (error) {
    console.error('❌ 真实工程逻辑测试失败（Mock 版本）:', error);
    testLog.push({
      step: 'error',
      description: '测试失败',
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        message: '真实工程逻辑测试失败（Mock 版本）',
        error: error instanceof Error ? error.message : String(error),
        testLog,
      },
      { status: 500 }
    );
  }
}
