/**
 * Agent B 引擎组件测试 API
 * 独立测试各个组件，不依赖完整工作流
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';
import { db } from '@/lib/db';
import { agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// 导入Mock服务
import { 
  setMockScenario, 
  getNextMockDecision,
  resetMockScenario,
  getAvailableScenarios 
} from '@/lib/test-utils/mock-llm-service';

import { 
  executeMockMcp, 
  resetMcpStrategies,
  presetAllSuccess,
  presetFailThenSuccess,
  presetAllFail
} from '@/lib/test-utils/mock-mcp-service';

// 导入类型
import { 
  McpAttempt 
} from '@/lib/services/subtask-execution-engine';

/**
 * 测试 MCP 多次尝试机制
 */
async function testMcpRetryLogic(scenario: string): Promise<any> {
  console.log(`\n========== 测试 MCP 重试机制 ==========`);
  
  const testResults: any = {
    scenario,
    mcpAttempts: [],
    finalSuccess: false,
    attemptCount: 0
  };
  
  const mcpExecutionHistory: McpAttempt[] = [];
  const maxAttempts = 3;
  let attemptCount = 0;
  
  resetMcpStrategies();
  if (scenario === 'mcp_retry_success') {
    presetFailThenSuccess();
  } else if (scenario === 'mcp_three_failures') {
    presetAllFail();
  } else {
    presetAllSuccess();
  }
  
  while (attemptCount < maxAttempts) {
    attemptCount++;
    console.log(`[Test] MCP尝试 ${attemptCount}/${maxAttempts}`);
    
    const attemptId = `mcp-${Date.now()}-${attemptCount}`;
    const startTime = Date.now();
    
    try {
      const toolName = 'web_search';
      const actionName = attemptCount === 1 ? 'searchEngine' : 
                         attemptCount === 2 ? 'simulateBrowser' : 'directFetch';
      
      const result = await executeMockMcp(toolName, actionName, {
        accountId: 'test-account',
        query: '测试查询'
      });
      
      const executionTime = Date.now() - startTime;
      
      const mcpAttempt: McpAttempt = {
        attemptId,
        attemptNumber: attemptCount,
        timestamp: getCurrentBeijingTime(),
        decision: {
          solutionNum: 20 + attemptCount,
          toolName,
          actionName,
          reasoning: `第${attemptCount}次尝试`,
          strategy: attemptCount === 1 ? 'initial' : 'switch_type'
        },
        params: { accountId: 'test-account', query: '测试查询' },
        result: {
          status: 'success',
          data: result,
          executionTime
        }
      };
      
      mcpExecutionHistory.push(mcpAttempt);
      testResults.mcpAttempts.push({
        attemptNumber: attemptCount,
        toolName,
        actionName,
        status: 'success',
        executionTime
      });
      
      testResults.finalSuccess = true;
      console.log(`[Test] MCP尝试成功`);
      break;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      const mcpAttempt: McpAttempt = {
        attemptId,
        attemptNumber: attemptCount,
        timestamp: getCurrentBeijingTime(),
        decision: {
          solutionNum: 20 + attemptCount,
          toolName: 'web_search',
          actionName: attemptCount === 1 ? 'searchEngine' : 
                      attemptCount === 2 ? 'simulateBrowser' : 'directFetch',
          reasoning: `第${attemptCount}次尝试`,
          strategy: attemptCount === 1 ? 'initial' : 'switch_type'
        },
        params: { accountId: 'test-account', query: '测试查询' },
        result: {
          status: 'failed',
          error: {
            code: 'MOCK_ERROR',
            message: error instanceof Error ? error.message : '执行失败',
            type: 'unknown'
          },
          executionTime
        },
        failureAnalysis: {
          isRetryable: attemptCount < maxAttempts,
          failureType: 'temporary',
          suggestedNextAction: attemptCount < maxAttempts ? 'switch_method' : 'retry_same'
        }
      };
      
      mcpExecutionHistory.push(mcpAttempt);
      testResults.mcpAttempts.push({
        attemptNumber: attemptCount,
        toolName: 'web_search',
        actionName: attemptCount === 1 ? 'searchEngine' : 
                    attemptCount === 2 ? 'simulateBrowser' : 'directFetch',
        status: 'failed',
        executionTime,
        error: error instanceof Error ? error.message : '执行失败'
      });
      
      console.log(`[Test] MCP尝试失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
  
  testResults.attemptCount = attemptCount;
  testResults.mcpExecutionHistory = mcpExecutionHistory;
  
  return testResults;
}

/**
 * 测试 Agent B 决策流程
 */
async function testAgentBDecisionFlow(scenario: string): Promise<any> {
  console.log(`\n========== 测试 Agent B 决策流程 ==========`);
  
  const testResults: any = {
    scenario,
    decisions: [],
    finalDecision: null
  };
  
  if (!setMockScenario(scenario)) {
    throw new Error(`未知场景: ${scenario}`);
  }
  
  const maxRounds = 5;
  let round = 0;
  
  while (round < maxRounds) {
    round++;
    console.log(`[Test] 第${round}轮决策`);
    
    const decision = getNextMockDecision();
    if (!decision) {
      console.log('[Test] 没有更多决策');
      break;
    }
    
    testResults.decisions.push({
      round,
      type: decision.type,
      reasonCode: decision.reasonCode,
      reasoning: decision.reasoning
    });
    
    console.log(`[Test] 决策类型: ${decision.type}`);
    
    if (decision.type === 'COMPLETE' || decision.type === 'FAILED') {
      testResults.finalDecision = decision;
      testResults.finalStatus = decision.type === 'COMPLETE' ? 'completed' : 'failed';
      break;
    } else if (decision.type === 'NEED_USER') {
      testResults.finalDecision = decision;
      testResults.finalStatus = 'waiting_user';
      break;
    }
    
    if (round >= maxRounds) {
      testResults.finalStatus = 'max_iterations_exceeded';
      break;
    }
  }
  
  testResults.totalRounds = round;
  resetMockScenario();
  
  return testResults;
}

/**
 * 测试数据记录完整性（含数据库验证）
 * 使用已存在的 commandResultId 进行测试
 */
async function testDataRecording(scenario: string): Promise<any> {
  console.log(`\n========== 测试数据记录完整性 ==========`);
  
  const testId = `test-record-${Date.now()}`;
  const now = getCurrentBeijingTime();
  
  // 查询一个已存在的 commandResultId
  console.log('[Test] 查询有效的 commandResultId...');
  const existingTasks = await db.query.agentSubTasks.findMany({ limit: 1 });
  
  if (existingTasks.length === 0) {
    return {
      testId,
      scenario,
      error: '数据库中没有 agent_sub_tasks 记录，无法执行数据库验证测试',
      validationPassed: false
    };
  }
  
  // 使用现有的 commandResultId
  const commandResultId = existingTasks[0].commandResultId;
  console.log('[Test] 使用 commandResultId:', commandResultId);
  
  // 构建完整的测试记录
  const testRecord = {
    interact_type: 'response',
    consultant: 'insurance-d',
    responder: 'agent B',
    question: { problem: '测试问题' },
    response: {
      decision: {
        type: 'COMPLETE',
        reason_code: 'TASK_DONE',
        reasoning: '测试完成',
        final_conclusion: '任务成功完成'
      },
      mcp_attempts: [
        {
          attempt_id: 'mcp-001',
          attempt_number: 1,
          timestamp: now.toISOString(),
          decision: {
            solution_num: 21,
            tool_name: 'web_search',
            action_name: 'searchEngine',
            reasoning: '首次尝试',
            strategy: 'initial'
          },
          params: { account_id: 'test', query: 'test' },
          result: {
            status: 'success',
            data: { result: 'success' },
            execution_time: 1000
          }
        },
        {
          attempt_id: 'mcp-002',
          attempt_number: 2,
          timestamp: now.toISOString(),
          decision: {
            solution_num: 22,
            tool_name: 'web_search',
            action_name: 'simulateBrowser',
            reasoning: '第二次尝试',
            strategy: 'switch_type'
          },
          params: { account_id: 'test', url: 'https://test.com' },
          result: {
            status: 'failed',
            error: {
              code: 'TIMEOUT',
              message: '超时',
              type: 'timeout'
            },
            execution_time: 30000
          },
          failure_analysis: {
            is_retryable: true,
            failure_type: 'temporary',
            suggested_next_action: 'switch_method'
          }
        }
      ],
      user_interactions: [],
      execution_summary: {
        total_mcp_attempts: 2,
        successful_mcp_attempts: 1,
        failed_mcp_attempts: 1,
        total_user_interactions: 0,
        start_time: now.toISOString(),
        end_time: now.toISOString(),
        total_duration: 31000
      }
    },
    execution_result: { status: 'success' },
    ext_info: {
      step: 'test_step',
      iteration: 1
    }
  };
  
  let dbInsertResult = { success: false, error: null as any, recordId: null as number | null };
  let dbQueryResult = { found: false, record: null as any, validation: {} as any };
  
  try {
    // 1. 插入测试数据到数据库（使用 Drizzle ORM）
    console.log('[Test] 插入测试数据到数据库...');
    
    const testStepNo = Math.floor(Math.random() * 1000000) + 100000;
    
    const inserted = await db.insert(agentSubTasksStepHistory).values({
      commandResultId: commandResultId,
      stepNo: testStepNo,
      interactType: 'response',
      interactNum: 1,
      interactContent: testRecord,
      interactUser: 'agent B',
      interactTime: now
    }).returning();
    
    const recordId = inserted[0]?.id;
    
    dbInsertResult = { 
      success: true, 
      error: null,
      recordId: recordId
    };
    
    console.log('[Test] 数据插入成功, ID:', recordId);
    
    // 2. 查询验证数据是否正确写入
    console.log('[Test] 查询验证数据...');
    
    const records = await db.query.agentSubTasksStepHistory.findMany({
      where: eq(agentSubTasksStepHistory.id, recordId!)
    });
    
    if (records.length === 0) {
      throw new Error('未找到插入的记录');
    }
    
    const record = records[0];
    dbQueryResult.found = true;
    dbQueryResult.record = {
      id: record.id,
      commandResultId: record.commandResultId,
      stepNo: record.stepNo,
      interactType: record.interactType,
      interactNum: record.interactNum,
      interactUser: record.interactUser,
      interactTime: record.interactTime?.toISOString()
    };
    
    // 3. 验证 interact_content 数据结构
    console.log('[Test] 验证数据库中的数据结构...');
    
    const content = record.interactContent as any;
    
    dbQueryResult.validation = {
      // 顶层字段
      hasInteractType: !!content?.interact_type,
      hasConsultant: !!content?.consultant,
      hasResponder: !!content?.responder,
      hasQuestion: !!content?.question,
      hasResponse: !!content?.response,
      hasExecutionResult: !!content?.execution_result,
      hasExtInfo: !!content?.ext_info,
      
      // response 字段
      response: {
        hasDecision: !!content?.response?.decision,
        hasDecisionType: !!content?.response?.decision?.type,
        hasDecisionReasonCode: !!content?.response?.decision?.reason_code,
        hasDecisionReasoning: !!content?.response?.decision?.reasoning,
        hasMcpAttempts: Array.isArray(content?.response?.mcp_attempts),
        mcpAttemptCount: content?.response?.mcp_attempts?.length || 0,
        hasUserInteractions: Array.isArray(content?.response?.user_interactions),
        hasExecutionSummary: !!content?.response?.execution_summary
      },
      
      // mcp_attempts 结构验证
      mcpAttemptsValid: false
    };
    
    // 验证 mcp_attempts 每个元素的字段
    if (Array.isArray(content?.response?.mcp_attempts)) {
      const mcpValidations = content.response.mcp_attempts.map((attempt: any, index: number) => ({
        index,
        hasAttemptId: !!attempt?.attempt_id,
        hasAttemptNumber: typeof attempt?.attempt_number === 'number',
        hasTimestamp: !!attempt?.timestamp,
        hasDecision: !!attempt?.decision,
        hasDecisionSolutionNum: typeof attempt?.decision?.solution_num === 'number',
        hasDecisionToolName: !!attempt?.decision?.tool_name,
        hasDecisionActionName: !!attempt?.decision?.action_name,
        hasParams: !!attempt?.params,
        hasResult: !!attempt?.result,
        hasResultStatus: !!attempt?.result?.status,
        hasFailureAnalysis: attempt?.result?.status === 'failed' ? !!attempt?.failure_analysis : true
      }));
      
      dbQueryResult.validation.mcpAttemptsValid = mcpValidations.every((v: any) => 
        v.hasAttemptId && v.hasAttemptNumber && v.hasTimestamp && 
        v.hasDecision && v.hasDecisionSolutionNum && v.hasDecisionToolName && 
        v.hasDecisionActionName && v.hasParams && v.hasResult && 
        v.hasResultStatus && v.hasFailureAnalysis
      );
      
      dbQueryResult.validation.mcpAttemptsDetail = mcpValidations;
    }
    
    // 4. 清理测试数据
    console.log('[Test] 清理测试数据...');
    await db.delete(agentSubTasksStepHistory)
      .where(eq(agentSubTasksStepHistory.id, recordId!));
    console.log('[Test] 测试数据已清理');
    
  } catch (error) {
    console.error('[Test] 数据库操作失败:', error);
    dbInsertResult.error = error instanceof Error ? error.message : String(error);
    
    // 尝试清理
    if (dbInsertResult.recordId) {
      try {
        await db.delete(agentSubTasksStepHistory)
          .where(eq(agentSubTasksStepHistory.id, dbInsertResult.recordId));
      } catch {}
    }
  }
  
  return {
    testId,
    commandResultId,
    scenario,
    dbInsert: dbInsertResult,
    dbQuery: dbQueryResult,
    validationPassed: dbInsertResult.success && 
                      dbQueryResult.found && 
                      dbQueryResult.validation?.mcpAttemptsValid
  };
}

// POST 处理函数
export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const testType = searchParams.get('type') || 'mcp_retry';
  const scenario = searchParams.get('scenario') || 'single_mcp_success';
  
  console.log(`\n========== Agent B组件测试开始 ==========`);
  console.log(`测试类型: ${testType}, 场景: ${scenario}`);
  
  try {
    let testResults: any;
    
    switch (testType) {
      case 'mcp_retry':
        testResults = await testMcpRetryLogic(scenario);
        break;
        
      case 'agent_decision':
        testResults = await testAgentBDecisionFlow(scenario);
        break;
        
      case 'data_recording':
        testResults = await testDataRecording(scenario);
        break;
        
      default:
        return NextResponse.json({
          success: false,
          error: '未知测试类型',
          availableTypes: ['mcp_retry', 'agent_decision', 'data_recording']
        }, { status: 400 });
    }
    
    console.log('========== Agent B组件测试完成 ==========\n');
    
    return NextResponse.json({
      success: true,
      testType,
      scenario,
      results: testResults
    });
    
  } catch (error) {
    console.error('[TestError]', error);
    
    return NextResponse.json({
      success: false,
      testType,
      scenario,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// GET 处理函数
export async function GET() {
  return NextResponse.json({
    availableTests: [
      {
        type: 'mcp_retry',
        description: '测试MCP多次尝试机制',
        scenarios: ['single_mcp_success', 'mcp_retry_success', 'mcp_three_failures']
      },
      {
        type: 'agent_decision',
        description: '测试Agent B决策流程',
        scenarios: getAvailableScenarios().map(s => s.key)
      },
      {
        type: 'data_recording',
        description: '测试数据记录完整性（含数据库验证）',
        scenarios: ['default']
      }
    ],
    usage: 'POST /api/test/agent-b-components?type={type}&scenario={scenario}'
  });
}
