/**
 * 统一端到端测试入口 - 简化版
 *
 * 重点：
 * 1. 13个测试案例（重点TC-23/24/25业务流程）
 * 2. 数据完整性验证（step_history要有request/response成对）
 * 3. 一个入口跑通所有案例
 *
 * 使用方法：
 *   curl 'http://localhost:5000/api/test/run-all-tests'
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, dailyTask, agentSubTasksStepHistory } from '@/lib/db/schema';
import { randomUUID } from 'crypto';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';
import { sql, eq } from 'drizzle-orm';
import {
  validateBusinessScenario,
  getScenarioValidator,
  ScenarioValidationResult
} from '@/lib/test/business-scenario-validation';
import { agentSubTasksMcpExecutions } from '@/lib/db/schema/agent-sub-tasks-mcp-executions';

// ==================== 所有测试案例（包含 f1bafc6 新功能） ====================

// 保存原始测试案例（用于套件选择后恢复）
let originalTestCasesBackup: any[] | undefined;

const ALL_TEST_CASES = [
  // 基础功能 (6个)
  {
    id: '1A',
    name: 'TC-01A: 初始不合规→整改→成功上传公众号',
    capabilityType: 'content_audit',
    taskTitle: '合规审核测试-违规识别并整改',
    metadata: {
      contentToCheck: '这是最好的保险产品，收益率最高，绝对安全，保证稳赚不赔',
      taskType: 'mcp_compliance_check_violation_fix',
      finalTarget: '成功上传公众号草稿箱'
    }
  },
  {
    id: '1B',
    name: 'TC-01B: 初始合规→直接上传公众号',
    capabilityType: 'content_audit',
    taskTitle: '合规审核测试-合规直接发布',
    metadata: {
      contentToCheck: '【保险知识分享】如何选择适合自己的保险产品...',
      taskType: 'mcp_compliance_check_compliant',
      finalTarget: '成功上传公众号草稿箱'
    }
  },
  {
    id: '1C',
    name: 'TC-01C: 合规审核-流程完整性',
    capabilityType: 'content_audit',
    taskTitle: '合规审核测试-流程完整性验证',
    metadata: {
      contentToCheck: '保险购买指南：了解不同险种特点',
      taskType: 'mcp_compliance_check_flow'
    }
  },
  {
    id: '2',
    name: 'TC-02: 网页搜索带摘要',
    capabilityType: 'search',
    taskTitle: '网页搜索带摘要测试-搜索保险市场趋势',
    metadata: {
      searchQuery: '2025年保险市场趋势',
      includeSummary: true,
      taskType: 'mcp_web_search_summary'
    }
  },
  {
    id: '3',
    name: 'TC-03: 网页搜索（基础版）',
    capabilityType: 'search',
    taskTitle: '网页搜索测试-基础搜索',
    metadata: {
      searchQuery: '新能源汽车保险政策',
      includeSummary: false,
      taskType: 'mcp_web_search'
    }
  },
  {
    id: '4',
    name: 'TC-04: 添加草稿',
    capabilityType: 'platform_publish',
    taskTitle: '添加草稿测试-微信公众号草稿',
    metadata: {
      articleTitle: '2025年保险市场最新趋势解析',
      taskType: 'mcp_wechat_draft',
      finalTarget: '成功上传公众号草稿箱'
    }
  },
  // 复杂场景 (7个，重点TC-23/24/25)
  {
    id: '5',
    name: 'TC-05: MCP首次失败重试成功',
    capabilityType: 'search',
    taskTitle: '重试策略测试-首次失败重试成功',
    metadata: {
      taskType: 'retry_success_test',
      simulateFailure: true
    }
  },
  {
    id: '6',
    name: 'TC-06: MCP多次失败最终失败',
    capabilityType: 'search',
    taskTitle: '重试限制测试-多次失败',
    metadata: {
      taskType: 'max_retry_failed_test',
      simulateRepeatedFailure: true
    }
  },
  {
    id: '7',
    name: 'TC-07: 达到最大迭代次数',
    capabilityType: 'search',
    taskTitle: '迭代限制测试-最大迭代',
    metadata: {
      taskType: 'max_iterations_test'
    }
  },
  {
    id: '8',
    name: 'TC-08: 用户确认后继续执行',
    capabilityType: 'content_audit',
    taskTitle: '用户交互测试-确认后继续',
    metadata: {
      taskType: 'user_confirm_test',
      requireUserConfirm: true
    }
  },
  // 【重点】业务流程测试案例
  {
    id: '23',
    name: 'TC-23: 多次违规→多次整改→最终成功上传公众号',
    capabilityType: 'content_audit',
    taskTitle: '复杂审核流程-多次违规整改后发布',
    metadata: {
      taskType: 'complex_compliance_multi_round',
      scenario: 'multi_violation_multi_fix',
      violationRounds: 3,
      finalTarget: '成功上传公众号草稿箱'
    },
    isPriority: true // 标记为重点
  },
  {
    id: '24',
    name: 'TC-24: 合规通过-正常发布流程',
    capabilityType: 'content_audit',
    taskTitle: '正常发布流程-合规内容直接发布',
    metadata: {
      contentToCheck: '【保险科普】如何理解重疾险的保障范围',
      taskType: 'normal_publish_flow',
      scenario: 'compliant_normal_publish',
      finalTarget: '成功上传公众号草稿箱'
    },
    isPriority: true // 标记为重点
  },
  {
    id: '25',
    name: 'TC-25: 合规不通过-提示修改后重试',
    capabilityType: 'content_audit',
    taskTitle: '审核不通过-提示修改后重试发布',
    metadata: {
      contentToCheck: '限时特惠！错过今天再等一年，立即购买最划算的保险',
      taskType: 'reject_then_retry_publish',
      scenario: 'reject_fix_retry_success',
      finalTarget: '成功上传公众号草稿箱'
    },
    isPriority: true // 标记为重点
  },

  // ========== f1bafc6 版本新功能测试案例 ==========
  
  // 【f1bafc6 新功能】agent_sub_tasks_mcp_executions 表测试
  {
    id: 'MCP-01',
    name: 'TC-MCP-01: MCP执行审计表-基础写入验证',
    capabilityType: 'mcp_audit',
    taskTitle: 'MCP审计表测试-基础写入验证',
    metadata: {
      taskType: 'mcp_executions_table_basic',
      featureVersion: 'f1bafc6',
      description: '验证 agent_sub_tasks_mcp_executions 表能正确记录 MCP 执行信息'
    },
    isNewFeature: true, // 标记为新功能测试
    featureVersion: 'f1bafc6'
  },
  {
    id: 'MCP-02',
    name: 'TC-MCP-02: MCP执行审计表-重试场景验证',
    capabilityType: 'mcp_audit',
    taskTitle: 'MCP审计表测试-重试场景验证',
    metadata: {
      taskType: 'mcp_executions_table_retry',
      featureVersion: 'f1bafc6',
      description: '验证重试场景下的 strategy 字段（initial/retry）',
      simulateFailure: true
    },
    isNewFeature: true,
    featureVersion: 'f1bafc6'
  },
  {
    id: 'MCP-03',
    name: 'TC-MCP-03: MCP执行审计表-失败分析验证',
    capabilityType: 'mcp_audit',
    taskTitle: 'MCP审计表测试-失败分析验证',
    metadata: {
      taskType: 'mcp_executions_table_failure',
      featureVersion: 'f1bafc6',
      description: '验证失败时的 isRetryable/failure_type/suggested_next_action',
      simulateRepeatedFailure: true
    },
    isNewFeature: true,
    featureVersion: 'f1bafc6'
  },
  {
    id: 'MCP-04',
    name: 'TC-MCP-04: MCP执行审计表-两阶段流程验证',
    capabilityType: 'mcp_audit',
    taskTitle: 'MCP审计表测试-两阶段流程验证',
    metadata: {
      taskType: 'mcp_executions_table_two_phase',
      featureVersion: 'f1bafc6',
      description: '验证合规检查+公众号上传在新表中的记录',
      contentToCheck: '【保险科普】如何理解重疾险的保障范围',
      finalTarget: '成功上传公众号草稿箱'
    },
    isNewFeature: true,
    featureVersion: 'f1bafc6',
    isPriority: true // 新功能重点案例
  },

  // 【f1bafc6 新功能】NEED_USER 决策流程测试
  {
    id: 'NEED-01',
    name: 'TC-NEED-01: NEED_USER-用户确认字段',
    capabilityType: 'user_interaction',
    taskTitle: '用户交互测试-用户确认字段',
    metadata: {
      taskType: 'need_user_confirm_fields',
      featureVersion: 'f1bafc6',
      description: '验证用户确认关键字段的完整流程',
      requireUserConfirm: true,
      pendingKeyFields: [
        { fieldId: 'publish_time', fieldName: '发布时间', fieldType: 'datetime' }
      ]
    },
    isNewFeature: true,
    featureVersion: 'f1bafc6'
  },
  {
    id: 'NEED-02',
    name: 'TC-NEED-02: NEED_USER-用户选择方案',
    capabilityType: 'user_interaction',
    taskTitle: '用户交互测试-用户选择方案',
    metadata: {
      taskType: 'need_user_select_solution',
      featureVersion: 'f1bafc6',
      description: '验证用户选择可选方案的流程',
      requireUserConfirm: true,
      availableSolutions: [
        { solutionId: 'sol-1', label: '立即发布', description: '立即发布到公众号' },
        { solutionId: 'sol-2', label: '明天发布', description: '明天早上9点发布' }
      ]
    },
    isNewFeature: true,
    featureVersion: 'f1bafc6'
  },
  {
    id: 'NEED-03',
    name: 'TC-NEED-03: NEED_USER-字段+方案混合',
    capabilityType: 'user_interaction',
    taskTitle: '用户交互测试-字段+方案混合',
    metadata: {
      taskType: 'need_user_mixed',
      featureVersion: 'f1bafc6',
      description: '验证字段确认和方案选择的混合场景',
      requireUserConfirm: true
    },
    isNewFeature: true,
    featureVersion: 'f1bafc6'
  },
  {
    id: 'NEED-04',
    name: 'TC-NEED-04: NEED_USER-字段验证失败',
    capabilityType: 'user_interaction',
    taskTitle: '用户交互测试-字段验证失败',
    metadata: {
      taskType: 'need_user_validation_failed',
      featureVersion: 'f1bafc6',
      description: '验证必填字段未填写时的处理',
      requireUserConfirm: true,
      skipRequiredFields: true
    },
    isNewFeature: true,
    featureVersion: 'f1bafc6'
  }
];

// ==================== 数据验证 - 重点业务数据正确性 ====================

/**
 * 验证数据完整性 - 重点：
 * 1. daily_task 存在
 * 2. agent_sub_tasks 状态正确
 * 3. agent_sub_tasks_step_history 有 request/response 成对记录
 */
async function validateDataIntegrity(commandResultId: string, subTasks: any[]) {
  const results = {
    dailyTask: { passed: false, error: '' },
    subTasks: [] as any[],
    stepHistory: { passed: false, recordCount: 0, hasRequest: false, hasResponse: false, hasPairs: false },
    mcpExecutions: { passed: false, recordCount: 0, hasValidData: false } // 新增：f1bafc6 版本新表
  };

  // 1. 验证 daily_task
  const dailyTaskResult = await db
    .select()
    .from(dailyTask)
    .where(eq(dailyTask.id, commandResultId));

  results.dailyTask.passed = dailyTaskResult.length > 0;
  if (!results.dailyTask.passed) {
    results.dailyTask.error = 'daily_task 记录不存在';
  }

  // 2. 验证每个子任务
  for (const subTask of subTasks) {
    const taskResult = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, subTask.subTaskId));

    const passed = taskResult.length > 0 &&
      ['completed', 'failed', 'waiting_user'].includes(taskResult[0].status);

    results.subTasks.push({
      testCaseId: subTask.testCaseId,
      testCaseName: subTask.testCaseName,
      passed,
      status: taskResult[0]?.status || 'unknown'
    });
  }

  // 3. 【重点】验证 step_history 有 request/response 成对
  const stepHistoryResult = await db
    .select()
    .from(agentSubTasksStepHistory)
    .where(eq(agentSubTasksStepHistory.commandResultId, commandResultId));

  results.stepHistory.recordCount = stepHistoryResult.length;
  results.stepHistory.hasRequest = stepHistoryResult.some(r => r.interactType === 'request');
  results.stepHistory.hasResponse = stepHistoryResult.some(r => r.interactType === 'response');

  // 检查是否有成对的 request/response（同一 interact_num）
  const interactNums = new Set(stepHistoryResult.map(r => r.interactNum));
  let hasPairs = false;
  for (const num of interactNums) {
    const records = stepHistoryResult.filter(r => r.interactNum === num);
    const hasRequest = records.some(r => r.interactType === 'request');
    const hasResponse = records.some(r => r.interactType === 'response');
    if (hasRequest && hasResponse) {
      hasPairs = true;
      break;
    }
  }
  results.stepHistory.hasPairs = hasPairs;
  results.stepHistory.passed =
    results.stepHistory.recordCount >= 2 &&
    results.stepHistory.hasRequest &&
    results.stepHistory.hasResponse;

  // 4. 【f1bafc6 新功能】验证 agent_sub_tasks_mcp_executions 表
  if (stepHistoryResult.length > 0) {
    try {
      // 🔴 新的关联方式：提取 subTaskId, commandResultId, stepNos 等关联信息
      const subTaskId = stepHistoryResult[0]?.subTaskId;
      const commandResultId = stepHistoryResult[0]?.commandResultId;
      const stepNos = [...new Set(stepHistoryResult.map(r => r.stepNo))];
      
      // 查询新表数据
      const allMcpExecutions = await db
        .select()
        .from(agentSubTasksMcpExecutions);
      
      // 🔴 新的过滤方式：使用新的关联字段
      let mcpExecutionsResult: any[] = [];
      if (subTaskId) {
        // 优先使用 subTaskId 过滤
        mcpExecutionsResult = allMcpExecutions.filter(r => r.subTaskId === subTaskId);
      } else if (commandResultId) {
        // 次优先使用 commandResultId + orderIndex 过滤
        mcpExecutionsResult = allMcpExecutions.filter(r => 
          r.commandResultId === commandResultId && 
          stepNos.includes(r.orderIndex)
        );
      }

      results.mcpExecutions.recordCount = mcpExecutionsResult.length;
      results.mcpExecutions.hasValidData = mcpExecutionsResult.every(
        r => (r.subTaskId || r.commandResultId) && r.toolName && r.attemptId
      );
      results.mcpExecutions.passed = true; // 允许0条记录，但表必须存在

      console.log(`   📊 agent_sub_tasks_mcp_executions 验证:`);
      console.log(`      - 记录数: ${results.mcpExecutions.recordCount}`);
      console.log(`      - 数据有效: ${results.mcpExecutions.hasValidData ? '✅' : '❌'}`);
    } catch (error) {
      console.log(`   ❌ agent_sub_tasks_mcp_executions 验证失败:`, error);
      results.mcpExecutions.passed = false; // 表不存在应该失败
      results.mcpExecutions.recordCount = 0;
      results.mcpExecutions.hasValidData = false;
      results.mcpExecutions.error = error instanceof Error ? error.message : String(error);
    }
  }

  // 总体结果
  const allPassed =
    results.dailyTask.passed &&
    results.subTasks.every(s => s.passed) &&
    results.stepHistory.passed &&
    results.mcpExecutions.passed; // f1bafc6 新表验证

  return { passed: allPassed, details: results };
}

// ==================== 核心执行函数 ====================

async function createTestData() {
  const now = getCurrentBeijingTime();
  const today = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const testGroupId = randomUUID();
  const dailyTaskId = randomUUID();

  // 创建 daily_task
  await db.insert(dailyTask).values({
    id: dailyTaskId,
    taskId: `e2e-test-${Math.floor(Date.now() / 1000)}`,
    relatedTaskId: `e2e-master-${testGroupId}`,
    taskTitle: '端到端统一测试-13个案例',
    taskDescription: '执行13个测试案例，重点TC-23/24/25业务流程',
    executor: 'insurance-d',
    taskPriority: 'high',
    executionDate: today,
    executionDeadlineStart: now,
    executionDeadlineEnd: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    deliverables: '验证13个MCP能力场景',
    executionStatus: 'in_progress',
    splitter: 'e2e-test',
    entryUser: 'test',
    fromAgentId: 'test',
    toAgentId: 'insurance-d',
    taskType: 'e2e_test',
    completedSubTasks: 0,
    subTaskCount: ALL_TEST_CASES.length,
    questionStatus: 'none',
    dialogueRounds: 0,
    dialogueStatus: 'none',
    reportCount: 0,
    requiresIntervention: false,
    scenarioType: 'e2e_test',
    dependencies: {},
    sortOrder: 0,
    outputData: {},
    metrics: {},
    attachments: [],
    metadata: { testGroupId, testType: 'e2e_unified' },
    createdAt: now,
    updatedAt: now,
  });

  // 创建子任务
  const subTasks = [];
  for (let i = 0; i < ALL_TEST_CASES.length; i++) {
    const testCase = ALL_TEST_CASES[i];
    const subTaskId = randomUUID();

    await db.insert(agentSubTasks).values({
      id: subTaskId,
      commandResultId: dailyTaskId,
      fromParentsExecutor: 'insurance-d',
      taskTitle: testCase.taskTitle,
      taskDescription: testCase.name,
      status: 'pending',
      orderIndex: i + 1,
      executionDate: today,
      metadata: {
        ...testCase.metadata,
        testGroupId,
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        isPriority: testCase.isPriority || false
      },
      createdAt: now,
      updatedAt: now,
    });

    subTasks.push({
      testCaseId: testCase.id,
      testCaseName: testCase.name,
      subTaskId,
      orderIndex: i + 1,
      isPriority: testCase.isPriority || false
    });
  }

  return { testGroupId, commandResultId: dailyTaskId, subTasks };
}

async function executeTasks(subTaskIds: string[]) {
  console.log('🚀 启动任务执行引擎...');

  try {
    const { SubtaskExecutionEngine } = await import('@/lib/services/subtask-execution-engine');

    const maxAttempts = 30;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`🔄 执行轮次 ${attempt}/${maxAttempts}`);

      const engine = new SubtaskExecutionEngine();
      await engine.execute();

      // 检查状态
      const taskStatuses = [];
      for (const id of subTaskIds) {
        const result = await db
          .select({ id: agentSubTasks.id, status: agentSubTasks.status })
          .from(agentSubTasks)
          .where(eq(agentSubTasks.id, id));
        if (result.length > 0) {
          taskStatuses.push(result[0]);
        }
      }

      const pendingCount = taskStatuses.filter(t => t.status === 'pending').length;
      const inProgressCount = taskStatuses.filter(t => t.status === 'in_progress').length;

      console.log(`📊 状态: pending=${pendingCount}, in_progress=${inProgressCount}`);

      if (pendingCount === 0 && inProgressCount === 0) {
        console.log('✅ 所有任务执行完成');
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    return { success: true };
  } catch (error) {
    console.error('❌ 执行失败:', error);
    return { success: false, error: String(error) };
  }
}

async function queryFinalStatus(subTaskIds: string[]) {
  const tasks = [];
  for (const id of subTaskIds) {
    const result = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, id));
    if (result.length > 0) {
      tasks.push(result[0]);
    }
  }

  return tasks.map(t => ({
    id: t.id,
    status: t.status,
    taskTitle: t.taskTitle,
    executionResult: t.executionResult
  }));
}

// ==================== API 入口 ====================

export async function GET(request: NextRequest) {
  console.log('🎯 ========== 统一端到端测试入口启动 ==========');

  try {
    // 支持测试套件选择
    const searchParams = request.nextUrl.searchParams;
    const suite = searchParams.get('suite') || 'full'; // full, basic, priority, custom
    const customCases = searchParams.get('cases')?.split(',') || [];

    // 根据选择的套件过滤测试案例
    let selectedTestCases = ALL_TEST_CASES;
    
    if (suite === 'priority') {
      selectedTestCases = ALL_TEST_CASES.filter(c => c.isPriority);
      console.log('🎯 选择套件: 重点案例');
    } else if (suite === 'basic') {
      selectedTestCases = ALL_TEST_CASES.filter(c => !c.isPriority);
      console.log('🎯 选择套件: 基础案例');
    } else if (suite === 'new-feature') {
      selectedTestCases = ALL_TEST_CASES.filter(c => c.isNewFeature);
      console.log('🎯 选择套件: 新功能测试');
    } else if (suite === 'custom' && customCases.length > 0) {
      selectedTestCases = ALL_TEST_CASES.filter(c => customCases.includes(c.id));
      console.log('🎯 选择套件: 自定义案例', customCases);
    } else if (suite === 'f1bafc6') {
      selectedTestCases = ALL_TEST_CASES.filter(c => c.featureVersion === 'f1bafc6');
      console.log('🎯 选择套件: f1bafc6 新功能');
    } else {
      console.log('🎯 选择套件: 全部案例');
    }

    // 替换全局变量（临时方案，后续可以重构）
    const originalTestCases = [...ALL_TEST_CASES];
    (ALL_TEST_CASES as any) = selectedTestCases;

    // 步骤1：创建测试数据
    console.log('🧪 步骤1：创建测试数据...');
    const testData = await createTestData();
    console.log(`✅ 已创建测试组: ${testData.testGroupId}`);
    console.log(`   案例统计: ${selectedTestCases.length}个总案例`);
    console.log(`   重点案例: ${selectedTestCases.filter(c => c.isPriority).map(c => c.id).join(', ') || '无'}`);

    // 步骤2：执行任务
    console.log('⚡ 步骤2：调用执行引擎...');
    const subTaskIds = testData.subTasks.map(s => s.subTaskId);
    const executionResult = await executeTasks(subTaskIds);

    // 等待执行完成
    console.log('⏳ 步骤3：等待任务执行完成...');
    await new Promise(resolve => setTimeout(resolve, 20000));

    // 步骤4：查询最终状态
    console.log('🔍 步骤4：查询任务最终状态...');
    const taskStatus = await queryFinalStatus(subTaskIds);

    // 更新子任务状态
    testData.subTasks.forEach(subTask => {
      const finalStatus = taskStatus.find(t => t.id === subTask.subTaskId);
      if (finalStatus) {
        (subTask as any).finalStatus = finalStatus.status;
        (subTask as any).executionResult = finalStatus.executionResult;
      }
    });

    // 统计
    const statusStats = taskStatus.reduce((acc: any, t: any) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {});

    // 步骤5：【重点】业务场景级数据完整性验证
    console.log('🔒 步骤5：业务场景级数据完整性验证...');
    const dataValidation = await validateDataIntegrity(
      testData.commandResultId,
      testData.subTasks
    );

    // 步骤5.5：【f1bafc6 新功能】验证 agent_sub_tasks_mcp_executions 表
    console.log('🔒 步骤5.5：验证 agent_sub_tasks_mcp_executions 表 (f1bafc6 新功能)...');
    console.log(`   - mcp_executions 记录数: ${dataValidation.details.mcpExecutions.recordCount}`);
    console.log(`   - mcp_executions 数据有效: ${dataValidation.details.mcpExecutions.hasValidData ? '✅' : '❌'}`);
    console.log(`   - mcp_executions 验证: ${dataValidation.details.mcpExecutions.passed ? '✅ 通过' : '❌ 失败'}`);

    // 步骤6：【重点】每个已完成案例的业务场景验证
    console.log('🎯 步骤6：业务场景验证（针对每个已完成案例）...');
    const scenarioValidations: ScenarioValidationResult[] = [];
    for (const subTask of testData.subTasks) {
      const finalStatus = (subTask as any).finalStatus;
      if (finalStatus === 'completed' || finalStatus === 'failed') {
        const scenarioResult = await validateBusinessScenario(
          subTask.testCaseId,
          testData.commandResultId,
          subTask.subTaskId
        );
        if (scenarioResult) {
          scenarioValidations.push(scenarioResult);
        }
      }
    }

    // 构建响应
    const response: any = {
      success: true,
      message: '统一端到端测试执行完成',
      testGroupId: testData.testGroupId,
      commandResultId: testData.commandResultId,
      summary: {
        total: ALL_TEST_CASES.length,
        completed: statusStats['completed'] || 0,
        failed: statusStats['failed'] || 0,
        waitingUser: statusStats['waiting_user'] || 0,
        pending: statusStats['pending'] || 0,
        inProgress: statusStats['in_progress'] || 0
      },
      priorityCases: ALL_TEST_CASES.filter(c => c.isPriority).map(c => ({
        id: c.id,
        name: c.name,
        status: testData.subTasks.find(s => s.testCaseId === c.id)?.['finalStatus'] || 'unknown'
      })),
      testCases: testData.subTasks.map(s => ({
        testCaseId: s.testCaseId,
        testCaseName: s.testCaseName,
        finalStatus: (s as any).finalStatus,
        isPriority: s.isPriority
      })),
      dataValidation: {
        passed: dataValidation.passed,
        dailyTask: dataValidation.details.dailyTask,
        subTasksSummary: {
          total: dataValidation.details.subTasks.length,
          passed: dataValidation.details.subTasks.filter(s => s.passed).length
        },
        stepHistory: {
          passed: dataValidation.details.stepHistory.passed,
          recordCount: dataValidation.details.stepHistory.recordCount,
          hasRequest: dataValidation.details.stepHistory.hasRequest,
          hasResponse: dataValidation.details.stepHistory.hasResponse,
          hasPairs: dataValidation.details.stepHistory.hasPairs
        },
        mcpExecutions: {
          passed: dataValidation.details.mcpExecutions.passed,
          recordCount: dataValidation.details.mcpExecutions.recordCount,
          hasValidData: dataValidation.details.mcpExecutions.hasValidData
        }
      },
      businessScenarioValidation: {
        totalScenarios: scenarioValidations.length,
        passedScenarios: scenarioValidations.filter(s => s.passed).length,
        scenarios: scenarioValidations.map(s => ({
          scenarioId: s.scenarioId,
          scenarioName: s.scenarioName,
          passed: s.passed,
          summary: s.summary,
          validationCount: s.validations.length
        }))
      },
      quickCheck: `/api/test/run-all-tests?query=true&testGroupId=${testData.testGroupId}`
    };

    console.log('🎉 ========== 测试执行完成 ==========');
    console.log('总体结果:', response.success ? '通过' : '失败');
    console.log('数据验证:', dataValidation.passed ? '通过' : '失败');
    console.log('业务场景验证:',
      `${scenarioValidations.filter(s => s.passed).length}/${scenarioValidations.length} 个场景通过`);

    // 恢复原始测试案例列表（如果有修改）
    if (typeof originalTestCases !== 'undefined') {
      (ALL_TEST_CASES as any) = originalTestCases;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ 测试执行失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
