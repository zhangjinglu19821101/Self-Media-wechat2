/**
 * 真实测试我们的工程逻辑
 * 
 * 测试流程：
 * 1. 模拟执行 agent 标准反馈（无法上传微信公众号）
 * 2. 真实调用 callAgentB() - 把信息给 agent B
 * 3. 真实调用 executeCapability() - 看 MCP 能不能被调用
 * 
 * 使用方法:
 * curl -X POST http://localhost:5000/api/test/real-engine-full-test
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

// Mock 微信 API 成功返回
const originalWechatAddDraft = (global as any).wechatAddDraftOriginal;
if (!originalWechatAddDraft) {
  // 保存原始函数
  const { wechatAddDraft } = require('@/lib/mcp/wechat-tools');
  (global as any).wechatAddDraftOriginal = wechatAddDraft;
  
  // Mock 版本：直接返回成功
  (require('@/lib/mcp/wechat-tools') as any).wechatAddDraft = async (params: any) => {
    console.log('🔧 [Mock] wechatAddDraft 被调用，返回 Mock 成功结果:', params);
    return {
      success: true,
      data: {
        media_id: 'mock_media_id_' + Date.now(),
        create_time: Date.now()
      },
      metadata: {
        accountId: params.accountId,
        accountName: '保险事业部公众号',
        timestamp: Date.now()
      }
    };
  };
}

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
  console.log('🧪 ========== 真实测试我们的工程逻辑 ==========');
  console.log('📋 目标：真实测试 callAgentB() 和 executeCapability()');

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
    
    // 创建一个临时的 task 对象（不需要插入数据库
    const tempTask = {
      id: 'temp-real-test-' + uuidv4(),
      commandResultId: dailyTask.id,
      fromParentsExecutor: dailyTask.executor || 'insurance-d',
      taskTitle: '真实测试：执行 agent 无法上传微信公众号',
      taskDescription: '真实测试我们的工程逻辑',
      status: 'in_progress',
      orderIndex: 994,
      isDispatched: true,
      startedAt: new Date(),
      timeoutHandlingCount: 0,
      escalated: false,
      executionDate: new Date().toISOString().split('T')[0],
      dialogueRounds: 0,
      dialogueStatus: 'none',
      metadata: { realEngineTest: true },
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
    // 步骤 2：模拟执行 agent 标准反馈（无法上传微信公众号
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
    
    console.log('🔍 [调试] 测试 API 中的 capabilities 数据:', capabilities.map(cap => ({
      id: cap.id,
      toolName: cap.toolName,
      actionName: cap.actionName,
      hasExampleOutput: !!(cap as any).example_output,
      exampleOutputKeys: (cap as any).example_output ? Object.keys((cap as any).example_output) : []
    })));
    
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
    // 步骤 5：真实调用 executeCapability()
    // ==========================================
    console.log('\n========== ⚡ 步骤 5：真实调用 executeCapability() ==========');
    
    console.log('📥 [步骤 5][入口参数] 调用 engine.executeCapability():', {
      taskId: tempTask.id,
      solutionNum: agentBOutput.solutionNum,
      toolName: (agentBOutput as any).toolName,
      actionName: (agentBOutput as any).actionName,
      params: (agentBOutput as any).params,
    });

    const mcpResult = await engine.executeCapability(tempTask, agentBOutput);
    
    console.log('📤 [步骤 5][出口结果] MCP 执行结果:', JSON.stringify(mcpResult, null, 2));

    testLog.push({
      step: '5',
      description: '真实调用 executeCapability()',
      inputParams: { solutionNum: agentBOutput.solutionNum },
      outputResult: mcpResult,
    });

    // ==========================================
    // 返回测试结果
    // ==========================================
    console.log('\n🎉 ========== 真实工程逻辑测试完成 ==========');

    return NextResponse.json({
      success: true,
      message: '真实工程逻辑测试完成',
      data: {
        testLog,
        summary: {
          step2: '✅ 完成 - 模拟执行 agent 反馈',
          step3: '✅ 完成 - 真实调用 queryCapabilityList()',
          step4: '✅ 完成 - 真实调用 callAgentB()',
          step5: mcpResult?.success ? '✅ 完成 - 真实调用 executeCapability()' : '❌ 失败 - 真实调用 executeCapability()',
        },
        keyOutputs: {
          mockExecutorResult,
          agentBOutput,
          mcpResult,
        },
      },
    });

  } catch (error) {
    console.error('❌ 真实工程逻辑测试失败:', error);
    testLog.push({
      step: 'error',
      description: '测试失败',
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        success: false,
        message: '真实工程逻辑测试失败',
        error: error instanceof Error ? error.message : String(error),
        testLog,
      },
      { status: 500 }
    );
  }
}
