/**
 * Agent B 引擎测试 API
 * 用于测试智能决策架构
 * 
 * 测试场景：
 * 1. single_mcp_success - 单次MCP成功
 * 2. mcp_retry_success - MCP重试后成功
 * 3. mcp_three_failures - MCP 3次失败
 * 4. need_user_select - 需要用户选择
 * 5. max_iterations_exceeded - 循环5轮
 * 
 * 使用方法:
 * POST /api/test/agent-b-engine?scenario=single_mcp_success
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { SubtaskExecutionEngine } from '@/lib/services/subtask-execution-engine';
import { 
  setMockScenario, 
  getMockScenarioInfo, 
  resetMockScenario,
  getAvailableScenarios 
} from '@/lib/test-utils/mock-llm-service';
import { 
  executeMockMcp, 
  resetMcpStrategies,
  presetAllSuccess,
  presetFailThenSuccess,
  presetTwoFailsThenSuccess,
  presetAllFail
} from '@/lib/test-utils/mock-mcp-service';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

// 保存原始函数
let originalCallLLM: any;
let originalGenericMCPCall: any;

/**
 * 注入Mock
 */
function injectMocks() {
  // 动态导入以获取原始函数
  const callLLMModule = require('@/lib/agent-llm');
  const genericMCPModule = require('@/lib/mcp/generic-mcp-call');
  
  originalCallLLM = callLLMModule.callLLM;
  originalGenericMCPCall = genericMCPModule.genericMCPCall;
  
  // Mock callLLM
  callLLMModule.callLLM = async (agent: string, task: string, systemPrompt: string, userPrompt: string) => {
    console.log(`[MockInject] callLLM被调用: agent=${agent}, task=${task}`);
    
    // 如果是Agent B调用，返回Mock决策
    if (agent === 'agent B' || task.includes('Agent B')) {
      const { getNextMockDecision } = require('@/lib/test-utils/mock-llm-service');
      const decision = getNextMockDecision();
      if (decision) {
        return JSON.stringify(decision);
      }
    }
    
    // 其他调用返回默认响应
    return JSON.stringify({ result: 'mock response' });
  };
  
  // Mock genericMCPCall
  genericMCPModule.genericMCPCall = async (toolName: string, actionName: string, params: any) => {
    console.log(`[MockInject] genericMCPCall被调用: ${toolName}/${actionName}`);
    return executeMockMcp(toolName, actionName, params);
  };
  
  console.log('[MockInject] Mock已注入');
}

/**
 * 恢复原始函数
 */
function restoreMocks() {
  if (originalCallLLM) {
    const callLLMModule = require('@/lib/agent-llm');
    callLLMModule.callLLM = originalCallLLM;
  }
  if (originalGenericMCPCall) {
    const genericMCPModule = require('@/lib/mcp/generic-mcp-call');
    genericMCPModule.genericMCPCall = originalGenericMCPCall;
  }
  console.log('[MockInject] Mock已恢复');
}

/**
 * 创建测试任务
 */
async function createTestTask(scenario: string) {
  const taskId = `test-${Date.now()}`;
  const now = getCurrentBeijingTime();
  
  await db.insert(agentSubTasks).values({
    id: taskId,
    commandResultId: `test-cmd-${Date.now()}`,
    taskTitle: `测试任务-${scenario}`,
    taskDescription: `Agent B引擎测试: ${scenario}`,
    taskType: 'test',
    fromParentsExecutor: 'insurance-d',
    status: 'pending',
    orderIndex: 1,
    executionDate: now.toISOString().split('T')[0],
    priority: 'medium',
    createdAt: now,
    updatedAt: now,
  });
  
  console.log(`[TestSetup] 创建测试任务: ${taskId}`);
  return taskId;
}

/**
 * 清理测试数据
 */
async function cleanupTestData(taskId: string) {
  // 删除步骤历史
  await db.delete(agentSubTasksStepHistory)
    .where(agentSubTasksStepHistory.commandResultId.like(`test-cmd%`));
  
  // 删除任务
  await db.delete(agentSubTasks)
    .where(agentSubTasks.id.like(`test-%`));
  
  console.log(`[TestCleanup] 清理测试数据: ${taskId}`);
}

/**
 * 查询测试结果
 */
async function getTestResults(taskId: string) {
  // 查询任务状态
  const task = await db.query.agentSubTasks.findFirst({
    where: (fields, { eq }) => eq(fields.id, taskId)
  });
  
  // 查询步骤历史
  const history = await db.query.agentSubTasksStepHistory.findMany({
    where: (fields, { like }) => like(fields.commandResultId, `test-cmd%`),
    orderBy: (fields, { asc }) => [asc(fields.interactNum)]
  });
  
  return { task, history };
}

/**
 * 验证数据结构
 */
function validateDataStructure(history: any[]) {
  const validation = {
    totalRecords: history.length,
    requestRecords: 0,
    responseRecords: 0,
    mcpAttempts: [] as number[],
    errors: [] as string[]
  };
  
  for (const record of history) {
    const content = record.interactContent;
    
    if (content.interact_type === 'request') {
      validation.requestRecords++;
    } else if (content.interact_type === 'response') {
      validation.responseRecords++;
      
      // 验证response结构
      if (!content.response) {
        validation.errors.push(`记录${record.interactNum}缺少response字段`);
        continue;
      }
      
      const response = content.response;
      
      // 验证decision
      if (!response.decision) {
        validation.errors.push(`记录${record.interactNum}缺少decision`);
      } else {
        if (!response.decision.type) validation.errors.push(`记录${record.interactNum}缺少decision.type`);
        if (!response.decision.reason_code) validation.errors.push(`记录${record.interactNum}缺少decision.reason_code`);
      }
      
      // 统计mcp_attempts
      if (response.mcp_attempts) {
        validation.mcpAttempts.push(response.mcp_attempts.length);
      }
    }
  }
  
  return validation;
}

// POST 处理函数
export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const scenario = searchParams.get('scenario') || 'single_mcp_success';
  const skipCleanup = searchParams.get('skipCleanup') === 'true';
  
  console.log(`\n========== Agent B引擎测试开始 ==========`);
  console.log(`场景: ${scenario}`);
  
  try {
    // 1. 设置Mock场景
    if (!setMockScenario(scenario)) {
      return NextResponse.json({
        success: false,
        error: '未知场景',
        availableScenarios: getAvailableScenarios()
      }, { status: 400 });
    }
    
    // 2. 设置MCP策略
    resetMcpStrategies();
    switch (scenario) {
      case 'single_mcp_success':
        presetAllSuccess();
        break;
      case 'mcp_retry_success':
        presetFailThenSuccess();
        break;
      case 'mcp_three_failures':
        presetAllFail();
        break;
      case 'max_iterations_exceeded':
        presetAllSuccess();
        break;
      case 'need_user_select':
        // NEED_USER场景不需要MCP执行
        break;
    }
    
    // 3. 注入Mock
    injectMocks();
    
    // 4. 创建测试任务
    const taskId = await createTestTask(scenario);
    
    // 5. 获取任务并执行
    const task = await db.query.agentSubTasks.findFirst({
      where: (fields, { eq }) => eq(fields.id, taskId)
    });
    
    if (!task) {
      throw new Error('任务创建失败');
    }
    
    // 6. 执行引擎
    const engine = new SubtaskExecutionEngine();
    
    // 直接调用核心方法（绕过轮询逻辑）
    await (engine as any).executeCompleteWorkflow(task);
    
    // 7. 获取结果
    const results = await getTestResults(taskId);
    
    // 8. 验证数据结构
    const validation = validateDataStructure(results.history);
    
    // 9. 构建测试报告
    const testReport = {
      scenario,
      scenarioInfo: getMockScenarioInfo(),
      taskStatus: results.task?.status,
      executionResult: results.task?.executionResult,
      validation,
      historySummary: results.history.map(h => ({
        interactNum: h.interactNum,
        interactType: h.interactType,
        interactUser: h.interactUser,
        decisionType: h.interactContent?.response?.decision?.type
      })),
      fullHistory: results.history.map(h => ({
        interactNum: h.interactNum,
        interactType: h.interactType,
        interactUser: h.interactUser,
        interactContent: h.interactContent
      }))
    };
    
    // 10. 清理数据
    if (!skipCleanup) {
      await cleanupTestData(taskId);
    }
    
    // 11. 恢复Mock
    restoreMocks();
    resetMockScenario();
    
    console.log('========== Agent B引擎测试完成 ==========\n');
    
    return NextResponse.json({
      success: true,
      testReport
    });
    
  } catch (error) {
    console.error('[TestError]', error);
    restoreMocks();
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

// GET 处理函数 - 获取可用场景
export async function GET() {
  return NextResponse.json({
    availableScenarios: getAvailableScenarios(),
    usage: 'POST /api/test/agent-b-engine?scenario={scenarioName}'
  });
}
