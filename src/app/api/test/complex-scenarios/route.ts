/**
 * 端到端复杂场景测试 API
 *
 * 测试场景：
 * TC-05: MCP 首次失败重试成功
 * TC-06: MCP 多次失败最终失败
 * TC-07: 达到最大迭代次数
 * TC-08: 用户确认后继续执行
 *
 * GET /api/test/complex-scenarios
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, dailyTask } from '@/lib/db/schema';
import { randomUUID } from 'crypto';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';
import { sql } from 'drizzle-orm';

// 复杂场景测试用例配置
const COMPLEX_TEST_CASES = [
  {
    id: 'TC-05',
    name: 'MCP 首次失败重试成功',
    description: '模拟 MCP 调用首次超时，重试后成功的场景',
    capabilityType: 'search',
    expectedDecisionFlow: ['EXECUTE_MCP', 'EXECUTE_MCP', 'COMPLETE'],
    expectedMcpAttempts: 2,
    expectedFinalStatus: 'completed',
    taskTitle: '【复杂场景】MCP重试测试-首次超时后成功',
    taskDescription: '模拟 MCP 调用首次超时，重试后成功的场景。验证重试策略和多次 MCP 尝试记录是否正确保存。',
    metadata: {
      mcpCapability: 'web_search',
      searchQuery: '模拟超时重试测试',
      simulateFailure: 'timeout_on_first_attempt',
      expectedAttempts: 2,
      taskType: 'mcp_retry_test',
      testScenario: 'retry_success_after_failure',
      estimatedHours: 0.5,
      acceptanceCriteria: '1. 首次调用超时失败；2. 自动重试；3. 第二次成功；4. step_history 保存 2 次尝试记录',
    }
  },
  {
    id: 'TC-06',
    name: 'MCP 多次失败最终失败',
    description: '模拟 MCP 连续失败，达到最大重试次数后终止',
    capabilityType: 'content_audit',
    expectedDecisionFlow: ['EXECUTE_MCP', 'EXECUTE_MCP', 'EXECUTE_MCP', 'FAILED'],
    expectedMcpAttempts: 3,
    expectedFinalStatus: 'failed',
    taskTitle: '【复杂场景】MCP重试测试-多次失败后终止',
    taskDescription: '模拟 MCP 调用连续失败（超时、网络错误、服务不可用），达到最大重试次数（3次）后任务失败的场景。',
    metadata: {
      mcpCapability: 'compliance_check',
      contentToCheck: '测试内容-模拟连续失败',
      simulateFailure: 'continuous_failures',
      failureSequence: ['TIMEOUT', 'NETWORK_ERROR', 'SERVICE_UNAVAILABLE'],
      maxAttempts: 3,
      expectedFinalStatus: 'failed',
      taskType: 'mcp_max_retry_test',
      testScenario: 'max_retry_exceeded',
      estimatedHours: 0.5,
      acceptanceCriteria: '1. 连续 3 次失败；2. 每次失败原因不同；3. 最终状态为 failed；4. 保存 3 次失败记录',
    }
  },
  {
    id: 'TC-07',
    name: '达到最大迭代次数',
    description: '模拟 Agent B 连续要求执行 MCP 但无法完成，达到最大迭代次数后终止',
    capabilityType: 'search',
    expectedDecisionFlow: ['EXECUTE_MCP', 'EXECUTE_MCP', 'EXECUTE_MCP', 'EXECUTE_MCP', 'EXECUTE_MCP', 'FAILED'],
    expectedMcpAttempts: 5,
    expectedFinalStatus: 'failed',
    taskTitle: '【复杂场景】最大迭代次数测试-超过限制',
    taskDescription: '模拟 Agent B 连续要求执行 MCP 但无法完成任务，达到最大迭代次数（5次）后强制终止的场景。',
    metadata: {
      mcpCapability: 'web_search',
      searchQuery: '模拟无限循环测试',
      simulateBehavior: 'infinite_mcp_loop',
      maxIterations: 5,
      expectedFinalStatus: 'failed',
      taskType: 'max_iteration_test',
      testScenario: 'max_iterations_reached',
      estimatedHours: 1,
      acceptanceCriteria: '1. 执行 5 轮迭代；2. 每轮都执行 MCP；3. 第 5 轮后强制失败；4. step_history 包含 5 轮记录',
    }
  },
  {
    id: 'TC-08',
    name: '用户确认后继续执行',
    description: '模拟需要用户确认关键字段，确认后继续执行的场景',
    capabilityType: 'content_audit',
    expectedDecisionFlow: ['NEED_USER', 'USER_CONFIRM', 'EXECUTE_MCP', 'COMPLETE'],
    expectedMcpAttempts: 1,
    expectedFinalStatus: 'completed',
    taskTitle: '【复杂场景】用户交互测试-确认后继续',
    taskDescription: '模拟需要用户确认关键字段（如文章标题、审核模式），用户确认后继续执行的场景。',
    metadata: {
      mcpCapability: 'compliance_check',
      initialContent: '待审核内容-需要用户确认',
      pendingFields: ['articleTitle', 'auditMode'],
      userResponse: {
        articleTitle: '保险知识科普文章',
        auditMode: 'full'
      },
      expectedFinalStatus: 'completed',
      taskType: 'user_interaction_test',
      testScenario: 'user_confirm_then_complete',
      estimatedHours: 0.5,
      acceptanceCriteria: '1. 首次进入 NEED_USER；2. 保存 pending_key_fields；3. 用户确认后继续；4. 最终完成任务',
    }
  }
];

/**
 * 创建复杂场景测试数据
 */
async function createComplexTestData() {
  const results: any[] = [];
  const now = getCurrentBeijingTime();
  const today = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const testGroupId = randomUUID();

  // 创建 daily_task 记录
  const dailyTaskId = randomUUID();
  const dailyTaskTaskId = `complex-test-${Math.floor(Date.now() / 1000)}`;

  await db.insert(dailyTask).values({
    id: dailyTaskId,
    taskId: dailyTaskTaskId,
    relatedTaskId: `complex-master-${testGroupId}`,
    taskTitle: '端到端复杂场景测试',
    taskDescription: '执行端到端复杂场景测试：MCP重试、最大迭代、用户交互',
    executor: 'insurance-d',
    taskPriority: 'high',
    executionDate: today,
    executionDeadlineStart: now,
    executionDeadlineEnd: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    deliverables: '验证4个复杂场景',
    executionStatus: 'in_progress',
    splitter: 'complex-test',
    entryUser: 'test',
    fromAgentId: 'test',
    toAgentId: 'insurance-d',
    taskType: 'complex_test',
    completedSubTasks: 0,
    subTaskCount: COMPLEX_TEST_CASES.length,
    questionStatus: 'none',
    dialogueRounds: 0,
    dialogueStatus: 'none',
    reportCount: 0,
    requiresIntervention: false,
    dependencies: {},
    sortOrder: 0,
    outputData: {},
    metrics: {},
    attachments: [],
    metadata: {
      testGroupId: testGroupId,
      testType: 'complex_scenarios',
    },
    createdAt: now,
    updatedAt: now,
  });

  console.log('✅ 已创建复杂场景 daily_task 记录:', dailyTaskId);

  // 创建复杂场景子任务
  for (const testCase of COMPLEX_TEST_CASES) {
    const subTaskId = randomUUID();

    await db.insert(agentSubTasks).values({
      id: subTaskId,
      commandResultId: dailyTaskId,
      fromParentsExecutor: 'insurance-d',
      taskTitle: testCase.taskTitle,
      taskDescription: testCase.taskDescription,
      status: 'pending',
      orderIndex: parseInt(testCase.id.replace('TC-', '')),
      executionDate: today,
      metadata: {
        ...testCase.metadata,
        testGroupId: testGroupId,
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        expectedDecisionFlow: testCase.expectedDecisionFlow,
        expectedMcpAttempts: testCase.expectedMcpAttempts,
        expectedFinalStatus: testCase.expectedFinalStatus,
      },
      createdAt: now,
      updatedAt: now,
    });

    results.push({
      testCaseId: testCase.id,
      testCaseName: testCase.name,
      subTaskId: subTaskId,
      expectedDecisionFlow: testCase.expectedDecisionFlow,
      expectedMcpAttempts: testCase.expectedMcpAttempts,
      expectedFinalStatus: testCase.expectedFinalStatus,
      status: 'created',
      capabilityType: testCase.capabilityType,
    });
  }

  return {
    testGroupId,
    commandResultId: dailyTaskId,
    subTasks: results,
  };
}

/**
 * 直接执行指定任务
 */
async function executeTasksDirectly(subTaskIds: string[]) {
  const results = [];
  
  try {
    console.log('🔔 [复杂场景] 启动任务执行...');
    
    const { SubtaskExecutionEngine } = await import('@/lib/services/subtask-execution-engine');
    
    for (const taskId of subTaskIds) {
      const taskResult = await db
        .select()
        .from(agentSubTasks)
        .where(sql`id = ${taskId}::uuid`)
        .limit(1);

      if (taskResult.length === 0) {
        results.push({ taskId, status: 'not_found' });
        continue;
      }

      const task = taskResult[0];
      console.log(`🚀 [复杂场景] 执行任务: ${task.taskTitle} (${taskId})`);

      try {
        const engine = new SubtaskExecutionEngine();
        await engine.execute(task);
        results.push({ taskId, status: 'executed', title: task.taskTitle });
      } catch (error) {
        console.error(`❌ [复杂场景] 任务执行失败: ${taskId}`, error);
        results.push({ taskId, status: 'error', error: String(error) });
      }
    }

    return { success: true, results };
  } catch (error) {
    console.error('[复杂场景] 执行失败:', error);
    return { success: false, error: String(error), results };
  }
}

/**
 * 查询测试状态
 */
async function queryTestStatus(testGroupId: string) {
  try {
    const subTasks = await db
      .select()
      .from(agentSubTasks)
      .where(sql`metadata->>'testGroupId' = ${testGroupId}`);

    const statusSummary = {
      total: subTasks.length,
      completed: 0,
      failed: 0,
      waiting_user: 0,
      in_progress: 0,
      pending: 0,
    };

    const details = subTasks.map(task => {
      statusSummary[task.status as keyof typeof statusSummary]++;
      return {
        testCaseId: task.metadata?.testCaseId || 'unknown',
        testCaseName: task.metadata?.testCaseName || task.taskTitle,
        subTaskId: task.id,
        status: task.status,
        capabilityType: task.metadata?.mcpCapability || 'unknown',
        expectedDecisionFlow: task.metadata?.expectedDecisionFlow,
        expectedFinalStatus: task.metadata?.expectedFinalStatus,
        updatedAt: task.updatedAt,
      };
    });

    return {
      success: true,
      testGroupId,
      statusSummary,
      details,
      allCompleted: statusSummary.completed + statusSummary.failed === subTasks.length,
    };
  } catch (error) {
    console.error('[复杂场景] 查询状态失败:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 查询 step_history 验证数据
 */
async function queryStepHistoryValidation(subTaskId: string) {
  try {
    const { sql } = await import('drizzle-orm');
    const result = await db.execute(sql`
      SELECT 
        h.interact_type,
        h.interact_num,
        h.interact_content->>'responder' as responder,
        h.interact_content->'response'->>'type' as decision_type,
        h.interact_content->'response'->>'reason_code' as reason_code,
        h.interact_content->'execution_result'->>'status' as exec_status,
        jsonb_array_length(COALESCE(h.interact_content->'response'->'mcp_attempts', '[]'::jsonb)) as mcp_attempt_count,
        h.interact_time::text as time
      FROM agent_sub_tasks_step_history h
      WHERE h.sub_task_id = ${subTaskId}::uuid
      ORDER BY h.interact_time
    `);

    // 获取 MCP 详细记录
    const mcpDetails = await db.execute(sql`
      SELECT 
        h.interact_content->'response'->'mcp_attempts' as mcp_attempts,
        h.interact_content->'response'->'execution_summary' as execution_summary
      FROM agent_sub_tasks_step_history h
      WHERE h.sub_task_id = ${subTaskId}::uuid
        AND h.interact_type = 'response'
      ORDER BY h.interact_time DESC
      LIMIT 1
    `);

    return {
      success: true,
      subTaskId,
      interactionCount: result.length,
      interactions: result,
      latestMcpDetails: mcpDetails[0] || null,
    };
  } catch (error) {
    console.error('[复杂场景] 查询 step_history 失败:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * GET 处理函数
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  const testGroupId = searchParams.get('testGroupId');
  const validate = searchParams.get('validate');
  const subTaskId = searchParams.get('subTaskId');

  try {
    // 查询 step_history 验证数据
    if (validate === 'true' && subTaskId) {
      const validation = await queryStepHistoryValidation(subTaskId);
      return NextResponse.json(validation);
    }

    // 查询测试状态
    if (query === 'true' && testGroupId) {
      const status = await queryTestStatus(testGroupId);
      return NextResponse.json(status);
    }

    // 默认：创建测试数据并执行
    console.log('🚀 [复杂场景] 开始创建测试数据...');
    const testData = await createComplexTestData();
    console.log('✅ [复杂场景] 测试数据创建完成:', testData.testGroupId);

    console.log('🚀 [复杂场景] 开始执行任务...');
    const execution = await executeTasksDirectly(
      testData.subTasks.map((s: any) => s.subTaskId)
    );
    console.log('✅ [复杂场景] 任务执行完成');

    return NextResponse.json({
      success: true,
      message: '✅ 复杂场景测试已启动',
      mode: 'run-all',
      testGroupId: testData.testGroupId,
      execution: execution,
      testCases: COMPLEX_TEST_CASES.map(tc => ({
        id: tc.id,
        name: tc.name,
        expectedDecisionFlow: tc.expectedDecisionFlow,
        expectedMcpAttempts: tc.expectedMcpAttempts,
        expectedFinalStatus: tc.expectedFinalStatus,
      })),
      queryEndpoints: {
        status: `/api/test/complex-scenarios?query=true&testGroupId=${testData.testGroupId}`,
        validate: `/api/test/complex-scenarios?validate=true&subTaskId={subTaskId}`,
      },
    });

  } catch (error) {
    console.error('[复杂场景] 执行失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: '复杂场景测试执行失败',
        error: String(error),
      },
      { status: 500 }
    );
  }
}
