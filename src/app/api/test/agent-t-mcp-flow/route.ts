/**
 * Agent T MCP 完整流程测试 API
 *
 * 测试目标：
 * 1. 展示给 Agent T 什么样的提示词
 * 2. Agent T 依据提示词输出了什么样的返回格式
 * 3. 这个返回格式是否成功推动控制器执行 MCP 逻辑
 * 
 * 【Executor 标准格式】
 * Agent T 返回格式与 insurance-d 一致，使用 isCompleted: true/false
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { capabilityList, agentSubTasks } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

// 导入 Agent T 提示词模块
import {
  AGENT_T_TECH_EXPERT_SYSTEM_PROMPT,
  buildAgentTTechExpertUserPrompt,
  type AgentTOutput
} from '@/lib/agents/prompts/agent-t-tech-expert';

// 导入 MCP 调用
import { genericMCPCall } from '@/lib/mcp/generic-mcp-call';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testScenario = searchParams.get('scenario') || 'compliance'; // 'compliance' | 'publish' | 'search'
  const dryRun = searchParams.get('dryRun') !== 'false'; // 默认 dryRun=true，不实际调用 MCP

  console.log('[Test API] Agent T MCP 完整流程测试开始');
  console.log('[Test API] 测试场景:', testScenario);
  console.log('[Test API] Dry Run:', dryRun);

  try {
    // ========== 步骤1：准备测试数据 ==========
    console.log('[Test API] ========== 步骤1：准备测试数据 ==========');
    const testData = await prepareTestData(testScenario);

    // ========== 步骤2：获取 capability_list 数据 ==========
    console.log('[Test API] ========== 步骤2：获取 capability_list 数据 ==========');
    const capabilities = await db
      .select()
      .from(capabilityList)
      .where(eq(capabilityList.status, 'available'))
      .limit(10);

    console.log('[Test API] 找到 capabilities 数量:', capabilities.length);

    // ========== 步骤3：构建给 Agent T 的提示词 ==========
    console.log('[Test API] ========== 步骤3：构建给 Agent T 的提示词 ==========');

    // 3.1 构建 capabilities 文本
    const capabilitiesText = buildCapabilitiesText(capabilities);

    // 3.2 构建 Agent T 用户提示词
    const agentTPrompt = buildAgentTTechExpertUserPrompt(
      testData.task,
      testData.executionContext,
      capabilitiesText,
      testData.mcpHistoryText,
      testData.priorStepOutputText,
      testData.defaultAccountId
    );

    console.log('[Test API] Agent T 系统提示词长度:', AGENT_T_TECH_EXPERT_SYSTEM_PROMPT.length);
    console.log('[Test API] Agent T 用户提示词长度:', agentTPrompt.length);

    // ========== 步骤4：模拟 Agent T 的输出（展示预期格式） ==========
    console.log('[Test API] ========== 步骤4：模拟 Agent T 的输出 ==========');
    const expectedAgentTOutput = simulateAgentTOutput(testData, capabilities);

    console.log('[Test API] Agent T 预期输出:', JSON.stringify(expectedAgentTOutput, null, 2));

    // ========== 步骤5：验证输出格式是否能被 executeCapability 接受 ==========
    console.log('[Test API] ========== 步骤5：验证输出格式 ==========');
    const formatValidation = validateAgentTOutputFormat(expectedAgentTOutput);

    // ========== 步骤6：实际测试 MCP 调用（如果不是 dryRun） ==========
    let mcpCallResult: any = null;
    if (!dryRun && formatValidation.success) {
      console.log('[Test API] ========== 步骤6：实际测试 MCP 调用 ==========');
      try {
        mcpCallResult = await testMCPCall(expectedAgentTOutput);
        console.log('[Test API] MCP 调用成功:', mcpCallResult);
      } catch (error) {
        console.error('[Test API] MCP 调用失败:', error);
        mcpCallResult = {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }

    // ========== 返回完整测试结果 ==========
    return NextResponse.json({
      success: true,
      testScenario,
      dryRun,
      timestamp: new Date().toISOString(),

      // ========== 1. 给 Agent T 的提示词 ==========
      prompts: {
        systemPrompt: {
          length: AGENT_T_TECH_EXPERT_SYSTEM_PROMPT.length,
          preview: AGENT_T_TECH_EXPERT_SYSTEM_PROMPT.substring(0, 800) + '...'
        },
        userPrompt: {
          length: agentTPrompt.length,
          preview: agentTPrompt.substring(0, 1500) + '...',
          full: agentTPrompt
        },
        capabilitiesText: {
          length: capabilitiesText.length,
          preview: capabilitiesText.substring(0, 1000) + '...'
        }
      },

      // ========== 2. Agent T 的预期输出格式 ==========
      agentTOutput: {
        expected: expectedAgentTOutput,
        formatValidation
      },

      // ========== 3. MCP 调用测试结果 ==========
      mcpCall: dryRun ? { skipped: true, reason: 'Dry run mode' } : mcpCallResult,

      // ========== 4. 测试数据摘要 ==========
      testData: {
        scenario: testScenario,
        taskTitle: testData.task.taskTitle,
        capabilitiesCount: capabilities.length,
        usedCapability: expectedAgentTOutput.mcpParams?.solutionNum
      },

      // ========== 5. 完整流程说明 ==========
      workflow: {
        step1: '准备测试数据和场景',
        step2: '从 capability_list 表获取可用 MCP 能力',
        step3: '构建给 Agent T 的系统提示词 + 用户提示词',
        step4: 'Agent T 根据提示词输出标准格式',
        step5: '验证输出格式能被 executeCapability 接受',
        step6: '使用输出格式实际调用 MCP（可选）'
      }
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
 * 准备测试数据
 */
async function prepareTestData(scenario: string) {
  // 从数据库获取一个真实的任务作为参考
  const referenceTask = await db
    .select()
    .from(agentSubTasks)
    .orderBy(desc(agentSubTasks.createdAt))
    .limit(1);

  const baseTask = referenceTask[0] || {
    id: 'test-task-001',
    taskTitle: '测试任务',
    orderIndex: 1,
    fromParentsExecutor: 'insurance-d'
  };

  let taskData: any;

  switch (scenario) {
    case 'compliance':
      taskData = {
        task: {
          id: baseTask.id,
          taskTitle: '保险文章合规审核',
          orderIndex: 2,
          fromParentsExecutor: 'insurance-d'
        },
        executionContext: {
          taskMeta: {
            taskId: baseTask.id,
            taskTitle: '保险文章合规审核',
            iterationCount: 1,
            maxIterations: 5
          },
          executorFeedback: {
            originalTask: '生成一篇保险文章',
            problem: '需要对文章进行合规性审核',
            capabilityType: 'compliance_check'
          }
        },
        priorStepOutputText: `
文章标题：2024年保险产品购买指南
文章内容：这是一篇关于保险产品的文章，介绍了各类保险产品的特点和投保建议。文章内容经过初步撰写，需要进行合规性审核。
`,
        mcpHistoryText: '暂无历史执行记录',
        defaultAccountId: 'insurance-account'
      };
      break;

    case 'publish':
      taskData = {
        task: {
          id: baseTask.id,
          taskTitle: '发布文章到微信公众号',
          orderIndex: 3,
          fromParentsExecutor: 'insurance-d'
        },
        executionContext: {
          taskMeta: {
            taskId: baseTask.id,
            taskTitle: '发布文章到微信公众号',
            iterationCount: 1,
            maxIterations: 5
          },
          executorFeedback: {
            originalTask: '生成并发布保险文章',
            problem: '需要将合规审核通过的文章发布到微信公众号',
            capabilityType: 'platform_publish'
          }
        },
        priorStepOutputText: `
文章标题：2024年保险产品购买指南
文章内容：<h1>保险产品购买指南</h1><p>这是一篇经过合规审核的保险文章...</p>
作者：保险助手
摘要：本文介绍2024年最新保险产品
`,
        mcpHistoryText: '第1轮：执行了合规审核，结果：通过',
        defaultAccountId: 'insurance-account'
      };
      break;

    case 'search':
    default:
      taskData = {
        task: {
          id: baseTask.id,
          taskTitle: '搜索保险产品信息',
          orderIndex: 1,
          fromParentsExecutor: 'insurance-d'
        },
        executionContext: {
          taskMeta: {
            taskId: baseTask.id,
            taskTitle: '搜索保险产品信息',
            iterationCount: 1,
            maxIterations: 5
          },
          executorFeedback: {
            originalTask: '调研最新保险产品',
            problem: '需要搜索2024年最新的保险产品信息',
            capabilityType: 'search'
          }
        },
        priorStepOutputText: '无前置输出',
        mcpHistoryText: '暂无历史执行记录',
        defaultAccountId: 'insurance-account'
      };
      break;
  }

  return taskData;
}

/**
 * 构建 capabilities 文本（与 subtask-execution-engine 中的 buildCapabilitiesText 一致）
 */
function buildCapabilitiesText(capabilities: any[]): string {
  return capabilities.map(cap =>
`能力 ID: ${cap.id}
功能描述: ${cap.functionDesc}
能力类型: ${cap.capabilityType}
工具名 (tool_name): ${cap.toolName}
动作名 (action_name): ${cap.actionName}
参数说明 (param_desc): ${typeof cap.paramDesc === 'string' ? cap.paramDesc : JSON.stringify(cap.paramDesc, null, 2)}
是否需要现场执行: ${cap.requiresOnSiteExecution}
输出样例 (example_output): ${cap.example_output ? (typeof cap.example_output === 'string' ? cap.example_output : JSON.stringify(cap.example_output, null, 2)) : '无'}`
  ).join('\n\n');
}

/**
 * 模拟 Agent T 的输出（Executor 标准格式）
 */
function simulateAgentTOutput(testData: any, capabilities: any[]): AgentTOutput {
  // 根据场景选择合适的 capability
  let selectedCapability = capabilities[0]; // 默认选第一个

  // 简单的匹配逻辑
  if (testData.task.taskTitle.includes('合规') || testData.task.taskTitle.includes('审核')) {
    selectedCapability = capabilities.find(c =>
      c.functionDesc?.includes('合规') ||
      c.functionDesc?.includes('审核') ||
      c.capabilityType?.includes('compliance')
    ) || selectedCapability;
  } else if (testData.task.taskTitle.includes('发布') || testData.task.taskTitle.includes('公众号')) {
    selectedCapability = capabilities.find(c =>
      c.functionDesc?.includes('发布') ||
      c.functionDesc?.includes('草稿') ||
      c.capabilityType?.includes('publish')
    ) || selectedCapability;
  } else if (testData.task.taskTitle.includes('搜索')) {
    selectedCapability = capabilities.find(c =>
      c.functionDesc?.includes('搜索') ||
      c.capabilityType?.includes('search')
    ) || selectedCapability;
  }

  // 构建 params（根据 param_desc）
  let params: any = {
    accountId: testData.defaultAccountId
  };

  // 简单的参数构建逻辑
  if (testData.priorStepOutputText && testData.priorStepOutputText !== '无前置输出') {
    // 尝试从 priorStepOutputText 中提取信息
    if (testData.priorStepOutputText.includes('文章标题')) {
      const titleMatch = testData.priorStepOutputText.match(/文章标题[：:]\s*(.+)/);
      const contentMatch = testData.priorStepOutputText.match(/文章内容[：:]\s*([\s\S]+?)(?=\n\S|$)/);

      if (titleMatch?.[1]) {
        params.articleTitle = titleMatch[1].trim();
        params.title = titleMatch[1].trim();
      }
      if (contentMatch?.[1]) {
        params.articleContent = contentMatch[1].trim();
        params.content = contentMatch[1].trim();
      }
    }
  }

  // 根据 capability 类型添加特定参数
  if (selectedCapability?.capabilityType?.includes('search')) {
    params.query = testData.task.taskTitle;
    params.num = 10;
  }

  // 🔴 Executor 标准格式
  return {
    canComplete: true,
    isCompleted: true,
    result: '【执行结论】MCP合规检查执行成功，文章已通过审核',
    suggestion: '',
    structuredResult: {
      originalInstruction: {
        title: testData.task.taskTitle,
        description: testData.executionContext.executorFeedback.problem
      },
      executionSummary: {
        needsMcpSupport: false,
        actionsTaken: [
          `根据 capability_list 匹配到 ${selectedCapability?.toolName} 工具`,
          '调用 MCP 工具',
          '获取执行结果'
        ],
        toolsUsed: [selectedCapability?.toolName || 'unknown'],
        resultContent: {
          approved: true,
          issues: [],
          riskLevel: 'low'
        }
      }
    },
    mcpParams: selectedCapability ? {
      solutionNum: selectedCapability.id,
      toolName: selectedCapability.toolName,
      actionName: selectedCapability.actionName,
      params
    } : undefined
  };
}

/**
 * 验证 Agent T 输出格式（Executor 标准格式）
 */
function validateAgentTOutputFormat(output: AgentTOutput) {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 检查必需字段
  if (typeof output.isCompleted !== 'boolean') {
    errors.push('缺少必需字段: isCompleted (boolean)');
  }

  if (!output.result) {
    errors.push('缺少必需字段: result');
  } else if (!output.result.startsWith('【执行结论】')) {
    warnings.push('result 应该以【执行结论】开头');
  }

  // 如果有 mcpParams，检查其格式
  if (output.mcpParams) {
    if (!output.mcpParams.solutionNum) {
      errors.push('mcpParams 中缺少 solutionNum');
    }
    if (!output.mcpParams.toolName) {
      errors.push('mcpParams 中缺少 toolName');
    }
    if (!output.mcpParams.actionName) {
      errors.push('mcpParams 中缺少 actionName');
    }
    if (!output.mcpParams.params) {
      errors.push('mcpParams 中缺少 params');
    } else if (!output.mcpParams.params.accountId) {
      warnings.push('mcpParams.params 中缺少 accountId（建议添加）');
    }
  }

  // 检查格式兼容性
  const executeCapabilityCompatible =
    output.isCompleted !== undefined &&
    !!output.result &&
    (!output.mcpParams || (
      !!output.mcpParams.toolName &&
      !!output.mcpParams.actionName &&
      !!output.mcpParams.params
    ));

  return {
    success: errors.length === 0,
    errors,
    warnings,
    executeCapabilityCompatible,
    message: executeCapabilityCompatible
      ? '✅ Executor 标准格式验证通过'
      : '❌ 格式验证失败'
  };
}

/**
 * 实际测试 MCP 调用
 */
async function testMCPCall(agentTOutput: AgentTOutput) {
  if (!agentTOutput.mcpParams) {
    return {
      success: false,
      error: 'Agent T 输出中没有 mcpParams，无法调用 MCP'
    };
  }

  console.log('[Test API] 测试 MCP 调用:', {
    toolName: agentTOutput.mcpParams.toolName,
    actionName: agentTOutput.mcpParams.actionName,
    params: agentTOutput.mcpParams.params
  });

  const result = await genericMCPCall(
    agentTOutput.mcpParams.toolName,
    agentTOutput.mcpParams.actionName,
    agentTOutput.mcpParams.params || {}
  );

  return {
    success: result.success,
    data: result.data,
    error: result.error,
    metadata: result.metadata
  };
}
