/**
 * 直接调用真实工程逻辑中的方法测试
 * 
 * 直接调用 SubtaskExecutionEngine 的 public 方法
 * 1. queryCapabilityList()
 * 2. callAgentB()
 * 3. executeCapability()
 * 
 * 使用方法:
 * curl -X POST http://localhost:5000/api/test/direct-call-real-methods \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "isNeedMcp": true,
 *     "problem": "无法上传微信公众号文章草稿，任务执行阻塞，缺少平台发布能力",
 *     "capabilityType": "platform_publish"
 *   }'
 */

import { NextRequest, NextResponse } from 'next/server';
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

export async function POST(request: NextRequest) {
  console.log('🧪 ========== 直接调用真实工程逻辑中的方法测试 ==========');
  console.log('📋 目标：直接调用 SubtaskExecutionEngine 的 public 方法');

  const testLog: any[] = [];
  const engine = new SubtaskExecutionEngine();

  try {
    // ==========================================
    // 步骤 0：读取输入 JSON
    // ==========================================
    console.log('\n========== 📥 步骤 0：读取输入 JSON ==========');
    const inputJson = await request.json();
    
    console.log('📥 [步骤 0][入口参数] 输入 JSON:', JSON.stringify(inputJson, null, 2));
    testLog.push({
      step: '0',
      description: '读取输入 JSON',
      inputJson,
    });

    // 构造 executorResult
    const executorResult: ExecutorAgentResult = {
      isNeedMcp: inputJson.isNeedMcp,
      problem: inputJson.problem,
      capabilityType: inputJson.capabilityType,
      isTaskDown: false,
    };

    // ==========================================
    // 前置准备：创建一个临时的 task 对象（因为方法需要 task 参数
    // ==========================================
    console.log('\n========== 🔧 前置准备：创建临时 task 对象 ==========');
    
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
      id: 'temp-' + uuidv4(),
      commandResultId: dailyTask.id,
      fromParentsExecutor: dailyTask.executor || 'insurance-d',
      taskTitle: '临时测试任务',
      taskDescription: '直接调用真实方法测试',
      status: 'in_progress',
      orderIndex: 995,
      isDispatched: true,
      startedAt: new Date(),
      timeoutHandlingCount: 0,
      escalated: false,
      executionDate: new Date().toISOString().split('T')[0],
      dialogueRounds: 0,
      dialogueStatus: 'none',
      metadata: { directTest: true },
    } as any;

    console.log('✅ 临时 task 对象创建完成:', {
      taskId: tempTask.id,
      taskTitle: tempTask.taskTitle,
    });
    testLog.push({
      step: 'prep',
      description: '创建临时 task 对象',
      tempTaskId: tempTask.id,
    });

    // ==========================================
    // 步骤 1：直接调用 queryCapabilityList()
    // ==========================================
    console.log('\n========== 🔍 步骤 1：直接调用 queryCapabilityList() ==========');
    console.log('📥 [步骤 1][入口参数] 调用 engine.queryCapabilityList():', {
      capabilityType: executorResult.capabilityType,
    });

    const capabilities = await engine.queryCapabilityList(executorResult.capabilityType);
    
    console.log('📤 [步骤 1][出口结果] 找到', capabilities.length, '个可用能力');
    console.log('📋 能力列表详情:', capabilities.map((cap: any) => ({
      id: cap.id,
      functionDesc: cap.functionDesc,
      toolName: cap.toolName,
      actionName: cap.actionName,
    })));

    testLog.push({
      step: '1',
      description: '调用 queryCapabilityList()',
      inputParams: { capabilityType: executorResult.capabilityType },
      outputResult: {
        capabilityCount: capabilities.length,
        capabilities: capabilities.map((c: any) => ({ id: c.id, functionDesc: c.functionDesc })),
      },
    });

    // ==========================================
    // 步骤 2：直接调用 callAgentB()
    // ==========================================
    console.log('\n========== 🤖 步骤 2：直接调用 callAgentB() ==========');
    console.log('📥 [步骤 2][入口参数] 调用 engine.callAgentB():', {
      taskId: tempTask.id,
      executorResult,
      capabilityCount: capabilities.length,
    });

    const agentBOutput = await engine.callAgentB(tempTask, executorResult, capabilities);
    
    console.log('📤 [步骤 2][出口结果] Agent B 输出:', JSON.stringify(agentBOutput, null, 2));

    testLog.push({
      step: '2',
      description: '调用 callAgentB()',
      inputParams: { executorResult, capabilityCount: capabilities.length },
      outputResult: agentBOutput,
    });

    // ==========================================
    // 步骤 3：直接调用 executeCapability()
    // ==========================================
    console.log('\n========== ⚡ 步骤 3：直接调用 executeCapability() ==========');
    console.log('📥 [步骤 3][入口参数] 调用 engine.executeCapability():', {
      taskId: tempTask.id,
      solutionNum: agentBOutput.solutionNum,
    });

    const mcpResult = await engine.executeCapability(tempTask, agentBOutput);
    
    console.log('📤 [步骤 3][出口结果] MCP 执行结果:', JSON.stringify(mcpResult, null, 2));

    testLog.push({
      step: '3',
      description: '调用 executeCapability()',
      inputParams: { solutionNum: agentBOutput.solutionNum },
      outputResult: mcpResult,
    });

    // ==========================================
    // 返回测试结果
    // ==========================================
    console.log('\n🎉 ========== 直接调用真实方法测试完成 ==========');

    return NextResponse.json({
      success: true,
      message: '直接调用真实工程逻辑中的方法测试完成',
      data: {
        testLog,
        summary: {
          step1: '✅ 完成 - queryCapabilityList()',
          step2: '✅ 完成 - callAgentB()',
          step3: mcpResult?.success ? '✅ 完成 - executeCapability()' : '❌ 失败 - executeCapability()',
        },
        keyOutputs: {
          inputJson,
          agentBOutput,
          mcpResult,
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
        message: '直接调用真实方法测试失败',
        error: error instanceof Error ? error.message : String(error),
        testLog,
      },
      { status: 500 }
    );
  }
}
