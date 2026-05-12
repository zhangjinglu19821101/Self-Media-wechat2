/**
 * Agent B 提示词重构测试 API
 * 用于验证我们的重构工作：
 * 1. 提示词文件导入测试
 * 2. 提示词构建函数测试
 * 3. 数据库数据测试
 * 4. 完整流程测试
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { capabilityList, agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, desc, and, gte } from 'drizzle-orm';

// 导入我们重构的提示词模块
import {
  AGENT_B_BUSINESS_CONTROLLER_SYSTEM_PROMPT,
  buildAgentBBusinessControllerUserPrompt,
  AGENT_B_OUTPUT_FORMAT
} from '@/lib/agents/prompts/agent-b-business-controller';
import {
  AGENT_T_TECH_EXPERT_SYSTEM_PROMPT,
  buildAgentTTechExpertUserPrompt
} from '@/lib/agents/prompts/agent-t-tech-expert';
import {
  generateComplianceCheckPrompt,
  parseComplianceCheckResult,
  generateComplianceTaskMetadata,
  type ComplianceCheckParams,
  type ComplianceCheckResult
} from '@/lib/agents/prompts/compliance-check';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testType = searchParams.get('type') || 'all'; // 'all' | 'import' | 'build' | 'database' | 'integration'
  
  console.log('[Test API] Agent B 提示词重构测试开始');
  console.log('[Test API] 测试类型:', testType);

  try {
    const testResults: any = {};

    // ========== 测试1：提示词模块导入测试 ==========
    if (testType === 'all' || testType === 'import') {
      console.log('[Test API] ========== 测试1：提示词模块导入 ==========');
      testResults.importTest = await testImports();
    }

    // ========== 测试2：提示词构建函数测试 ==========
    if (testType === 'all' || testType === 'build') {
      console.log('[Test API] ========== 测试2：提示词构建函数 ==========');
      testResults.buildTest = await testPromptBuilders();
    }

    // ========== 测试3：数据库数据测试 ==========
    if (testType === 'all' || testType === 'database') {
      console.log('[Test API] ========== 测试3：数据库数据 ==========');
      testResults.databaseTest = await testDatabaseData();
    }

    // ========== 测试4：集成测试 ==========
    if (testType === 'all' || testType === 'integration') {
      console.log('[Test API] ========== 测试4：集成测试 ==========');
      testResults.integrationTest = await testIntegration();
    }

    // ========== 生成测试报告 ==========
    const overallSuccess = Object.values(testResults).every(
      (result: any) => result?.success !== false
    );

    return NextResponse.json({
      success: overallSuccess,
      testType,
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: Object.keys(testResults).length,
        passedTests: Object.values(testResults).filter((r: any) => r?.success !== false).length,
        failedTests: Object.values(testResults).filter((r: any) => r?.success === false).length
      },
      results: testResults
    });

  } catch (error) {
    console.error('[Test API] 测试失败:', error);
    return NextResponse.json({
      success: false,
      error: '测试执行失败',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

/**
 * 测试1：提示词模块导入测试
 */
async function testImports() {
  const result = {
    success: true,
    tests: [] as any[]
  };

  try {
    // 测试 Agent B 系统提示词导入
    const test1 = {
      name: 'Agent B 系统提示词导入',
      success: !!AGENT_B_BUSINESS_CONTROLLER_SYSTEM_PROMPT,
      details: AGENT_B_BUSINESS_CONTROLLER_SYSTEM_PROMPT ? 
        `长度: ${AGENT_B_BUSINESS_CONTROLLER_SYSTEM_PROMPT.length} 字符` : 
        '导入失败'
    };
    result.tests.push(test1);
    if (!test1.success) result.success = false;

    // 测试 Agent B 用户提示词构建函数导入
    const test2 = {
      name: 'Agent B 用户提示词构建函数导入',
      success: typeof buildAgentBBusinessControllerUserPrompt === 'function',
      details: typeof buildAgentBBusinessControllerUserPrompt === 'function' ? 
        '函数导入成功' : '导入失败'
    };
    result.tests.push(test2);
    if (!test2.success) result.success = false;

    // 测试 Agent B 输出格式导入
    const test3 = {
      name: 'Agent B 输出格式导入',
      success: !!AGENT_B_OUTPUT_FORMAT,
      details: AGENT_B_OUTPUT_FORMAT ? 
        `长度: ${AGENT_B_OUTPUT_FORMAT.length} 字符` : '导入失败'
    };
    result.tests.push(test3);
    if (!test3.success) result.success = false;

    // 测试 Agent T 系统提示词导入
    const test4 = {
      name: 'Agent T 系统提示词导入',
      success: !!AGENT_T_TECH_EXPERT_SYSTEM_PROMPT,
      details: AGENT_T_TECH_EXPERT_SYSTEM_PROMPT ? 
        `长度: ${AGENT_T_TECH_EXPERT_SYSTEM_PROMPT.length} 字符` : '导入失败'
    };
    result.tests.push(test4);
    if (!test4.success) result.success = false;

    // 测试 Agent T 用户提示词构建函数导入
    const test5 = {
      name: 'Agent T 用户提示词构建函数导入',
      success: typeof buildAgentTTechExpertUserPrompt === 'function',
      details: typeof buildAgentTTechExpertUserPrompt === 'function' ? 
        '函数导入成功' : '导入失败'
    };
    result.tests.push(test5);
    if (!test5.success) result.success = false;

    // 测试合规校验提示词导入
    const test6 = {
      name: '合规校验提示词函数导入',
      success: typeof generateComplianceCheckPrompt === 'function' && 
               typeof parseComplianceCheckResult === 'function' &&
               typeof generateComplianceTaskMetadata === 'function',
      details: 'generateComplianceCheckPrompt, parseComplianceCheckResult, generateComplianceTaskMetadata 全部导入成功'
    };
    result.tests.push(test6);
    if (!test6.success) result.success = false;

  } catch (error) {
    result.success = false;
    result.tests.push({
      name: '导入测试异常',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  return result;
}

/**
 * 测试2：提示词构建函数测试
 */
async function testPromptBuilders() {
  const result = {
    success: true,
    tests: [] as any[]
  };

  try {
    // 构建测试数据
    const testTask = {
      id: 'test-task-001',
      taskTitle: '测试任务 - 保险文章合规校验',
      orderIndex: 2, // 合规校验任务
      fromParentsExecutor: 'insurance-d'
    };

    const testExecutionContext = {
      taskMeta: {
        taskId: 'test-task-001',
        iterationCount: 1,
        maxIterations: 5,
        taskTitle: '测试任务 - 保险文章合规校验'
      },
      executorFeedback: {
        originalTask: '生成一篇保险文章',
        problem: '需要对文章进行合规校验',
        suggestedApproach: '使用合规校验工具'
      }
    };

    const testCapabilitiesText = `
能力 ID: 20
功能描述: 微信公众号内容合规审核
能力类型: compliance_check
工具名: wechat_compliance
动作名: audit
参数说明: {"content": "文章内容"}
`;

    const testDefaultAccountId = 'insurance-test-account';

    // 测试 Agent B 提示词构建
    try {
      const agentBPrompt = buildAgentBBusinessControllerUserPrompt(
        testTask,
        testExecutionContext,
        testCapabilitiesText,
        '', // mcpHistoryText
        '', // userFeedbackText
        '', // executorOutputText
        '', // priorStepOutputText
        testDefaultAccountId
      );

      const test1 = {
        name: 'Agent B 用户提示词构建',
        success: !!agentBPrompt && agentBPrompt.length > 0,
        details: agentBPrompt ? 
          `构建成功，长度: ${agentBPrompt.length} 字符` : '构建失败',
        preview: agentBPrompt?.substring(0, 500) + '...'
      };
      result.tests.push(test1);
      if (!test1.success) result.success = false;
    } catch (error) {
      result.success = false;
      result.tests.push({
        name: 'Agent B 提示词构建异常',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // 测试 Agent T 提示词构建
    try {
      const agentTPrompt = buildAgentTTechExpertUserPrompt(
        testTask,
        testExecutionContext,
        testCapabilitiesText,
        '', // mcpHistoryText
        '测试文章内容...', // priorStepOutputText
        testDefaultAccountId
      );

      const test2 = {
        name: 'Agent T 用户提示词构建',
        success: !!agentTPrompt && agentTPrompt.length > 0,
        details: agentTPrompt ? 
          `构建成功，长度: ${agentTPrompt.length} 字符` : '构建失败',
        preview: agentTPrompt?.substring(0, 500) + '...'
      };
      result.tests.push(test2);
      if (!test2.success) result.success = false;
    } catch (error) {
      result.success = false;
      result.tests.push({
        name: 'Agent T 提示词构建异常',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // 测试合规校验提示词构建
    try {
      const complianceParams: ComplianceCheckParams = {
        articleTitle: '重疾险产品介绍',
        articleContent: '这是一篇测试保险文章...',
        taskId: 'test-task-001',
        originalCommand: '生成一篇保险文章'
      };

      const compliancePrompt = generateComplianceCheckPrompt(complianceParams);

      const test3 = {
        name: '合规校验提示词构建',
        success: !!compliancePrompt && compliancePrompt.length > 0,
        details: compliancePrompt ? 
          `构建成功，长度: ${compliancePrompt.length} 字符` : '构建失败',
        preview: compliancePrompt?.substring(0, 500) + '...'
      };
      result.tests.push(test3);
      if (!test3.success) result.success = false;
    } catch (error) {
      result.success = false;
      result.tests.push({
        name: '合规校验提示词构建异常',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // 测试合规校验结果解析
    try {
      const mockLLMResponse = `\`\`\`json
{
  "isCompliant": false,
  "score": 65,
  "summary": "文章存在一些合规问题需要修改",
  "issues": [
    {
      "type": "warning",
      "category": "风险提示",
      "description": "缺少足够的风险提示",
      "suggestion": "增加明确的风险提示内容"
    }
  ],
  "recommendations": ["增加风险提示", "避免夸大宣传"]
}
\`\`\``;

      const parsedResult = parseComplianceCheckResult(mockLLMResponse);

      const test4 = {
        name: '合规校验结果解析',
        success: !!parsedResult && typeof parsedResult.isCompliant === 'boolean',
        details: parsedResult ? 
          `解析成功，isCompliant: ${parsedResult.isCompliant}, score: ${parsedResult.score}` : '解析失败'
      };
      result.tests.push(test4);
      if (!test4.success) result.success = false;
    } catch (error) {
      result.success = false;
      result.tests.push({
        name: '合规校验结果解析异常',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // 测试合规任务元数据生成
    try {
      const taskMetadata = generateComplianceTaskMetadata({
        originalTaskId: 'original-task-001',
        articleTitle: '重疾险产品介绍',
        articleContent: '这是一篇测试保险文章...'
      });

      const test5 = {
        name: '合规任务元数据生成',
        success: !!taskMetadata && taskMetadata.taskType === 'compliance_check',
        details: taskMetadata ? 
          `生成成功，taskType: ${taskMetadata.taskType}` : '生成失败'
      };
      result.tests.push(test5);
      if (!test5.success) result.success = false;
    } catch (error) {
      result.success = false;
      result.tests.push({
        name: '合规任务元数据生成异常',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

  } catch (error) {
    result.success = false;
    result.tests.push({
      name: '构建函数测试异常',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  return result;
}

/**
 * 测试3：数据库数据测试
 */
async function testDatabaseData() {
  const result = {
    success: true,
    tests: [] as any[]
  };

  try {
    // 测试 capability_list 数据
    try {
      const capabilities = await db
        .select()
        .from(capabilityList)
        .where(eq(capabilityList.status, 'available'))
        .limit(10);

      const test1 = {
        name: 'capability_list 数据查询',
        success: true,
        count: capabilities.length,
        sample: capabilities.slice(0, 3).map(c => ({
          id: c.id,
          functionDesc: c.functionDesc,
          toolName: c.toolName,
          actionName: c.actionName
        }))
      };
      result.tests.push(test1);
    } catch (error) {
      result.success = false;
      result.tests.push({
        name: 'capability_list 查询异常',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // 测试 agent_sub_tasks 数据
    try {
      const tasks = await db
        .select()
        .from(agentSubTasks)
        .orderBy(desc(agentSubTasks.createdAt))
        .limit(5);

      const test2 = {
        name: 'agent_sub_tasks 数据查询',
        success: true,
        count: tasks.length,
        sample: tasks.slice(0, 3).map(t => ({
          id: t.id,
          taskTitle: t.taskTitle,
          status: t.status,
          orderIndex: t.orderIndex
        }))
      };
      result.tests.push(test2);
    } catch (error) {
      result.success = false;
      result.tests.push({
        name: 'agent_sub_tasks 查询异常',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // 测试 agent_sub_tasks_step_history 数据
    try {
      const history = await db
        .select()
        .from(agentSubTasksStepHistory)
        .limit(5);

      const test3 = {
        name: 'agent_sub_tasks_step_history 数据查询',
        success: true,
        count: history.length,
        sample: history.slice(0, 3).map(h => ({
          id: h.id,
          interactType: h.interactType,
          interactUser: h.interactUser
        }))
      };
      result.tests.push(test3);
    } catch (error) {
      result.success = false;
      result.tests.push({
        name: 'agent_sub_tasks_step_history 查询异常',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }

  } catch (error) {
    result.success = false;
    result.tests.push({
      name: '数据库测试异常',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  return result;
}

/**
 * 测试4：集成测试
 */
async function testIntegration() {
  const result = {
    success: true,
    tests: [] as any[]
  };

  try {
    // 从数据库获取真实数据进行集成测试
    const capabilities = await db
      .select()
      .from(capabilityList)
      .where(eq(capabilityList.status, 'available'))
      .limit(5);

    const tasks = await db
      .select()
      .from(agentSubTasks)
      .orderBy(desc(agentSubTasks.createdAt))
      .limit(3);

    if (capabilities.length > 0 && tasks.length > 0) {
      // 使用真实数据构建提示词
      const testTask = tasks[0];
      const capabilitiesText = capabilities.map(cap => 
`能力 ID: ${cap.id}
功能描述: ${cap.functionDesc}
能力类型: ${cap.capabilityType}
工具名: ${cap.toolName}
动作名: ${cap.actionName}`
      ).join('\n\n');

      // 构建 Agent B 提示词（使用真实数据）
      const agentBPrompt = buildAgentBBusinessControllerUserPrompt(
        {
          id: testTask.id,
          taskTitle: testTask.taskTitle || '未知任务',
          orderIndex: testTask.orderIndex || 1,
          fromParentsExecutor: testTask.fromParentsExecutor || 'insurance-d'
        },
        {
          taskMeta: {
            taskId: testTask.id,
            iterationCount: 1,
            maxIterations: 5,
            taskTitle: testTask.taskTitle || '未知任务'
          },
          executorFeedback: {
            originalTask: testTask.taskDescription || testTask.taskTitle || '未知任务',
            problem: '测试问题',
            suggestedApproach: '测试方案'
          }
        },
        capabilitiesText,
        '', // mcpHistoryText
        '', // userFeedbackText
        '', // executorOutputText
        testTask.executionResult || '', // priorStepOutputText
        'insurance-test-account'
      );

      const test1 = {
        name: '真实数据集成测试 - Agent B 提示词',
        success: !!agentBPrompt && agentBPrompt.length > 0,
        details: `使用任务ID: ${testTask.id}, capability数量: ${capabilities.length}`,
        promptLength: agentBPrompt?.length,
        taskTitle: testTask.taskTitle
      };
      result.tests.push(test1);
      if (!test1.success) result.success = false;

    } else {
      result.tests.push({
        name: '集成测试数据准备',
        success: true,
        warning: '数据库中数据不足，跳过部分集成测试',
        capabilitiesCount: capabilities.length,
        tasksCount: tasks.length
      });
    }

  } catch (error) {
    result.success = false;
    result.tests.push({
      name: '集成测试异常',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  return result;
}
