/**
 * Agent T 真实 LLM 调用测试 API
 *
 * 【真实测试】
 * 1. 调用真实的 LLM
 * 2. 使用 Agent T 提示词
 * 3. 让 LLM 真正生成 MCP 调用决策
 * 4. 用生成的决策真实调用 MCP
 * 
 * 【Executor 标准格式】
 * Agent T 返回格式与 insurance-d 一致，使用 isCompleted: true/false
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { capabilityList } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// 导入 Agent T 提示词模块
import {
  AGENT_T_TECH_EXPERT_SYSTEM_PROMPT,
  buildAgentTTechExpertUserPrompt,
  type AgentTOutput
} from '@/lib/agents/prompts/agent-t-tech-expert';

// 导入 LLM 调用
import { callLLM } from '@/lib/agent-llm';

// 导入 MCP 调用
import { genericMCPCall } from '@/lib/mcp/generic-mcp-call';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get('dryRun') !== 'false'; // 默认 dryRun=true，不实际调用 MCP

  console.log('[Test API] ========== Agent T 真实 LLM 测试开始 ==========');
  console.log('[Test API] Dry Run:', dryRun);

  const testLogs: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    testLogs.push(msg);
  };

  try {
    // ========== 步骤1：准备测试数据 ==========
    log('[Test API] 步骤1：准备测试数据');

    const testData = {
      task: {
        id: 'test-task-001',
        taskTitle: '保险文章合规审核',
        orderIndex: 2,
        fromParentsExecutor: 'insurance-d'
      },
      executionContext: {
        taskMeta: {
          taskId: 'test-task-001',
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
文章内容：这是一篇关于保险产品的文章，介绍了最好的保险产品，提供100%保本保息的承诺，让您投保无忧！
`,
      mcpHistoryText: '暂无历史执行记录',
      defaultAccountId: 'insurance-account'
    };

    log('[Test API] 测试数据准备完成');

    // ========== 步骤2：获取 capability_list 数据 ==========
    log('[Test API] 步骤2：获取 capability_list 数据');

    const capabilities = await db
      .select()
      .from(capabilityList)
      .where(eq(capabilityList.status, 'available'))
      .limit(10);

    log(`[Test API] 找到 ${capabilities.length} 个 capabilities`);

    // ========== 步骤3：构建给 Agent T 的提示词 ==========
    log('[Test API] 步骤3：构建给 Agent T 的提示词');

    const capabilitiesText = buildCapabilitiesText(capabilities);

    const agentTPrompt = buildAgentTTechExpertUserPrompt(
      testData.task,
      testData.executionContext,
      capabilitiesText,
      testData.mcpHistoryText,
      testData.priorStepOutputText,
      testData.defaultAccountId
    );

    log('[Test API] Agent T 提示词构建完成');
    log(`[Test API] System Prompt 长度: ${AGENT_T_TECH_EXPERT_SYSTEM_PROMPT.length}`);
    log(`[Test API] User Prompt 长度: ${agentTPrompt.length}`);

    // ========== 步骤4：调用真实 LLM ==========
    log('[Test API] ========== 步骤4：调用真实 LLM ==========');

    const llmStartTime = Date.now();
    let llmResponse: string;

    try {
      llmResponse = await callLLM(
        'insurance-t', // Agent ID
        testData.task.taskTitle, // 上下文
        AGENT_T_TECH_EXPERT_SYSTEM_PROMPT,
        agentTPrompt,
        { temperature: 0.3 }
      );
    } catch (llmError) {
      log(`[Test API] ❌ LLM 调用失败: ${llmError}`);
      throw llmError;
    }

    const llmEndTime = Date.now();
    log(`[Test API] ✅ LLM 调用成功，耗时: ${llmEndTime - llmStartTime}ms`);

    // ========== 步骤5：解析 LLM 输出 ==========
    log('[Test API] 步骤5：解析 LLM 输出');

    let agentTOutput: AgentTOutput;
    try {
      // 清理输出：移除 markdown 代码块标记
      let cleanedResponse = llmResponse
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      // 尝试提取 JSON
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        agentTOutput = JSON.parse(jsonMatch[0]);
        log('[Test API] ✅ JSON 解析成功');
      } else {
        throw new Error('未找到 JSON 格式的输出');
      }
    } catch (parseError) {
      log(`[Test API] ❌ 输出解析失败: ${parseError}`);
      log('[Test API] 原始输出: ' + llmResponse);
      throw parseError;
    }

    log('[Test API] Agent T 输出: ' + JSON.stringify(agentTOutput, null, 2));

    // ========== 步骤6：验证输出格式 ==========
    log('[Test API] 步骤6：验证输出格式');

    const formatValidation = validateAgentTOutputFormat(agentTOutput);
    log('[Test API] 格式验证: ' + formatValidation.message);

    // ========== 步骤7：真实测试 MCP 调用（如果不是 dryRun） ==========
    let mcpCallResult: any = null;
    if (!dryRun && formatValidation.success && agentTOutput.mcpParams) {
      log('[Test API] ========== 步骤7：真实测试 MCP 调用 ==========');
      try {
        mcpCallResult = await genericMCPCall(
          agentTOutput.mcpParams.toolName,
          agentTOutput.mcpParams.actionName,
          agentTOutput.mcpParams.params || {}
        );
        log('[Test API] ✅ MCP 调用成功');
      } catch (mcpError) {
        log(`[Test API] ❌ MCP 调用失败: ${mcpError}`);
        mcpCallResult = {
          success: false,
          error: mcpError instanceof Error ? mcpError.message : String(mcpError)
        };
      }
    } else {
      log('[Test API] 跳过 MCP 调用（dryRun 模式或格式验证失败）');
    }

    log('[Test API] ========== 测试完成 ==========');

    // ========== 返回完整测试结果 ==========
    return NextResponse.json({
      success: true,
      dryRun,
      timestamp: new Date().toISOString(),
      testLogs,

      // ========== 1. 提示词 ==========
      prompts: {
        systemPromptLength: AGENT_T_TECH_EXPERT_SYSTEM_PROMPT.length,
        userPromptLength: agentTPrompt.length,
        capabilitiesCount: capabilities.length
      },

      // ========== 2. LLM 调用 ==========
      llmCall: {
        success: true,
        startTime: new Date(llmStartTime).toISOString(),
        endTime: new Date(llmEndTime).toISOString(),
        durationMs: llmEndTime - llmStartTime,
        rawOutput: llmResponse,
        parsedOutput: agentTOutput
      },

      // ========== 3. 格式验证 ==========
      formatValidation,

      // ========== 4. MCP 调用 ==========
      mcpCall: dryRun ? { skipped: true, reason: 'Dry run mode' } : mcpCallResult
    });

  } catch (error) {
    console.error('[Test API] 测试失败:', error);
    return NextResponse.json({
      success: false,
      error: '测试执行失败',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      testLogs
    }, { status: 500 });
  }
}

/**
 * 构建 capabilities 文本
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
 * 验证 Agent T 输出格式（Executor Output 标准格式）
 */
function validateAgentTOutputFormat(output: AgentTOutput) {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ========== 检查 canComplete（必填）==========
  if (typeof output.canComplete !== 'boolean') {
    errors.push('缺少必需字段: canComplete (boolean)');
  }

  // ========== 检查 reason（当 canComplete=false 时必填）==========
  if (output.canComplete === false && !output.reason) {
    errors.push('canComplete=false 时必须填写 reason');
  }

  // ========== 检查 isCompleted（当 canComplete=true 时有意义）==========
  if (output.canComplete === true && typeof output.isCompleted !== 'boolean') {
    warnings.push('canComplete=true 时建议填写 isCompleted');
  }

  // ========== 检查 result（当 canComplete=true 时有意义）==========
  if (output.canComplete === true && !output.result) {
    errors.push('canComplete=true 时必须填写 result');
  } else if (output.result && !output.result.startsWith('【执行结论】')) {
    warnings.push('result 应该以【执行结论】开头');
  }

  // ========== 检查 mcpParams（当 canComplete=true 时必填）==========
  if (output.canComplete === true && !output.mcpParams) {
    errors.push('canComplete=true 时必须填写 mcpParams');
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
    output.canComplete !== undefined &&
    (output.canComplete === true ? !!output.mcpParams : true) &&
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
    message: errors.length === 0
      ? '✅ Executor Output 标准格式验证通过'
      : '❌ 格式验证失败'
  };
}
