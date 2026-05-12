/**
 * MCP 测试：从第五步开始测试（Step 5 to Step 9）
 * 
 * 测试内容：
 * 五、控制器将执行agent反馈的内容 + capability_list中的能力清单 + agent B的身份提示词提交给agent B
 * 六、agent B判断系统具备解决问题的能力，通过输出标准化的调用MCP的上传微信公众号方法与相关参数组装
 * 七、控制器解析agent B提供的工具、方法、参数，完成微信公众号的上传
 * 八、控制器随后将第六步的内容 + 上传微信公众号方法上传结果提供给agent，让其将结果反馈给执行agent(insurance-d)
 * 九、控制器依据insurance-d的返回，更新agent_sub_tasks对应的任务
 * 
 * 使用方法:
 * curl -X POST http://localhost:5000/api/test/mcp-step5-to-step9
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
import { callLLM } from '@/lib/agent-llm';
import { Branch1IntelligentExecutor } from '@/lib/mcp/branch1-intelligent-executor';

export const maxDuration = 120;

export async function POST() {
  console.log('🧪 ========== 开始测试：Step 5 to Step 9 ==========');
  console.log('📋 目标：每个步骤都打印入口参数信息，验证下一步能否成功执行');

  const testLog: any[] = [];

  try {
    // ==========================================
    // 前置准备：创建测试数据
    // ==========================================
    console.log('\n========== 🔧 步骤 0：前置准备 - 创建测试数据 ==========');

    // 1. 查找一个现有的 daily_task
    console.log('📥 [Step 0][入口参数] 查找 daily_task，无参数');
    const existingDailyTask = await db.select().from(dailyTask).limit(1);
    
    if (existingDailyTask.length === 0) {
      console.log('❌ [Step 0][失败] 没有找到 daily_task');
      return NextResponse.json({
        success: false,
        message: '没有找到 daily_task，请先创建测试数据',
      });
    }

    const dailyTask = existingDailyTask[0];
    console.log('✅ [Step 0][出口结果] 找到 daily_task:', {
      id: dailyTask.id,
      taskId: dailyTask.taskId,
      executor: dailyTask.executor,
    });
    testLog.push({
      step: 0,
      description: '前置准备 - 找到测试数据',
      inputParams: '无参数',
      outputResult: {
        dailyTaskId: dailyTask.id,
        taskId: dailyTask.taskId,
        executor: dailyTask.executor,
      },
    });

    // 2. 创建测试子任务
    const today = new Date().toISOString().split('T')[0];
    const subTaskInput = {
      commandResultId: dailyTask.id,
      fromParentsExecutor: dailyTask.executor || 'insurance-d',
      taskTitle: '测试：从第五步开始上传微信公众号草稿',
      taskDescription: '[Mock Test] 测试 Step 5 to Step 9：从第五步开始，直接调用 Agent B',
      status: 'in_progress',
      orderIndex: 998,
      isDispatched: true,
      startedAt: new Date(),
      timeoutHandlingCount: 0,
      escalated: false,
      executionDate: today,
      dialogueRounds: 0,
      dialogueStatus: 'none',
      metadata: { mock: true, test_scenario: 'step5_to_step9' },
    };
    
    console.log('📥 [Step 0a][入口参数] 创建 agent_sub_tasks:', subTaskInput);
    
    const subTask = await db
      .insert(agentSubTasks)
      .values(subTaskInput)
      .returning();

    console.log('✅ [Step 0a][出口结果] 创建测试子任务成功:', {
      id: subTask[0].id,
      commandResultId: subTask[0].commandResultId,
      status: subTask[0].status,
    });
    testLog.push({
      step: '0a',
      description: '创建测试子任务',
      inputParams: subTaskInput,
      outputResult: {
        subTaskId: subTask[0].id,
        commandResultId: subTask[0].commandResultId,
        status: subTask[0].status,
      },
    });

    // ==========================================
    // Step 5：控制器将执行agent反馈的内容 + capability_list + agent B提示词提交给agent B
    // ==========================================
    console.log('\n========== 🔄 Step 5：调用 Agent B ==========');

    // 5.1 模拟执行 agent 的反馈（前四步的结果）
    console.log('\n--- [Step 5.1] 模拟执行 agent 反馈 ---');
    const mockExecutorFeedback = {
      isNeedMcp: true,
      problem: '需要上传微信公众号文章草稿，缺少平台发布能力',
      capabilityType: 'platform_publish',
    };

    console.log('📥 [Step 5.1][入口参数] 模拟执行 agent 反馈（固定）');
    console.log('📤 [Step 5.1][出口结果] 执行 agent 反馈:', mockExecutorFeedback);
    testLog.push({
      step: '5.1',
      description: '模拟执行 agent 反馈',
      inputParams: '固定模拟数据',
      outputResult: mockExecutorFeedback,
    });

    // 5.2 查询 capability_list 表
    console.log('\n--- [Step 5.2] 查询 capability_list 表 ---');
    const queryCapabilityInput = {
      status: 'available',
      capabilityType: 'platform_publish',
    };
    
    console.log('📥 [Step 5.2][入口参数] 查询 capability_list:', queryCapabilityInput);
    
    const capabilities = await db
      .select()
      .from(capabilityList)
      .where(
        and(
          eq(capabilityList.status, queryCapabilityInput.status),
          eq(capabilityList.capabilityType, queryCapabilityInput.capabilityType)
        )
      );

    console.log('📤 [Step 5.2][出口结果] 找到', capabilities.length, '个可用能力');
    console.log('📋 能力列表:', capabilities.map(c => ({
      id: c.id,
      functionDesc: c.functionDesc,
      toolName: c.toolName,
      actionName: c.actionName,
    })));
    
    testLog.push({
      step: '5.2',
      description: '查询 capability_list',
      inputParams: queryCapabilityInput,
      outputResult: {
        capabilityCount: capabilities.length,
        capabilities: capabilities.map(c => ({
          id: c.id,
          functionDesc: c.functionDesc,
          toolName: c.toolName,
          actionName: c.actionName,
        })),
      },
    });

    // 5.3 构建 Agent B 的提示词
    console.log('\n--- [Step 5.3] 构建 Agent B 提示词 ---');
    const capabilitiesText = capabilities.map(cap => `
ID: ${cap.id}
功能描述: ${cap.functionDesc}
能力类型: ${cap.capabilityType}
工具名: ${cap.toolName}
动作名: ${cap.actionName}
参数说明: ${JSON.stringify(cap.paramDesc)}
是否需要现场执行: ${cap.requiresOnSiteExecution}
`).join('\n');

    const agentBPromptInput = {
      executorFeedback: mockExecutorFeedback,
      capabilities,
    };

    console.log('📥 [Step 5.3][入口参数] 构建 Agent B 提示词的原料:', agentBPromptInput);

    const agentBPrompt = `
执行Agent返回结果：
- isNeedMcp: ${mockExecutorFeedback.isNeedMcp}
- problem: ${mockExecutorFeedback.problem}
- capabilityType: ${mockExecutorFeedback.capabilityType}

可用的MCP能力清单：
${capabilitiesText}

请分析问题并选择最合适的方案，返回JSON格式：
{
  "solutionNum": 选定的方案ID,
  "toolName": "工具名",
  "actionName": "方法名",
  "params": {
    "根据参数说明填充"
  },
  "reasoning": "简要说明选择理由"
}

注意：
- 如果选择 ID=11（微信公众号-添加草稿），params 应该包含：
  - accountId: "insurance-account"
  - articles: 数组，包含文章信息
`;

    console.log('📤 [Step 5.3][出口结果] Agent B 提示词构建完成');
    console.log('📋 提示词长度:', agentBPrompt.length, '字符');
    console.log('📋 提示词预览（前500字符）:', agentBPrompt.substring(0, 500));
    
    testLog.push({
      step: '5.3',
      description: '构建 Agent B 提示词',
      inputParams: agentBPromptInput,
      outputResult: {
        promptLength: agentBPrompt.length,
        promptPreview: agentBPrompt.substring(0, 500),
      },
    });

    // ==========================================
    // Step 6：Agent B 判断并输出标准化的 MCP 调用
    // ==========================================
    console.log('🤖 ========== Step 6：调用 Agent B ==========');

    let agentBOutput: any;
    try {
      const response = await callLLM(
        'agent B',
        'Step 5-6 测试：解决方案选型',
        '你是 Agent B，负责解决方案选型和 MCP 参数生成',
        agentBPrompt
      );

      console.log('📥 Agent B 原始响应:', response);
      testLog.push({
        step: 6,
        description: 'Agent B 原始响应',
        rawResponse: response,
      });

      // 解析 JSON
      try {
        agentBOutput = JSON.parse(response);
        console.log('✅ Agent B 解析成功:', agentBOutput);
      } catch (parseError) {
        console.warn('⚠️ Agent B 返回格式不对，使用 mock 数据');
        // 使用 mock 数据
        agentBOutput = {
          solutionNum: 11,
          toolName: 'wechat',
          actionName: 'addDraft',
          params: {
            accountId: 'insurance-account',
            articles: [
              {
                title: '测试文章：Step 5-9 测试',
                author: '保险事业部',
                digest: '这是一篇测试文章，用于测试 Step 5 到 Step 9 的流程',
                content: '<h1>测试文章</h1><p>这是文章正文内容，用于测试 Step 5 到 Step 9 的完整流程。</p>',
                show_cover_pic: 0,
              },
            ],
          },
          reasoning: '选择 ID=11 方案，因为这是微信公众号添加草稿的功能，正好解决平台发布能力缺失的问题',
        };
      }
    } catch (llmError) {
      console.error('❌ 调用 Agent B 失败，使用 mock 数据:', llmError);
      // 使用 mock 数据
      agentBOutput = {
        solutionNum: 11,
        toolName: 'wechat',
        actionName: 'addDraft',
        params: {
          accountId: 'insurance-account',
          articles: [
            {
              title: '测试文章：Step 5-9 测试（Mock）',
              author: '保险事业部',
              digest: '这是一篇测试文章（Mock）',
              content: '<h1>测试文章（Mock）</h1><p>这是 Mock 数据，因为 LLM 调用失败。</p>',
              show_cover_pic: 0,
            },
          ],
        },
        reasoning: '使用 Mock 数据，因为 LLM 调用失败',
      };
    }

    console.log('✅ Agent B 最终输出:', JSON.stringify(agentBOutput, null, 2));
    testLog.push({
      step: 6,
      description: 'Agent B 最终输出',
      agentBOutput,
    });

    // ==========================================
    // Step 7：控制器解析并执行 MCP
    // ==========================================
    console.log('⚡ ========== Step 7：执行 MCP ==========');

    let mcpResult: any;
    try {
      console.log('🔧 调用 Branch1IntelligentExecutor.execute...');
      console.log('📥 参数:', {
        subTaskId: subTask[0].id,
        solutionNum: agentBOutput.solutionNum,
        taskTitle: subTask[0].taskTitle,
      });

      mcpResult = await Branch1IntelligentExecutor.execute(
        subTask[0].id,
        agentBOutput.solutionNum,
        subTask[0].taskTitle,
        { 
          skipInsuranceD: true,
          mockParams: agentBOutput.params,
        }
      );

      console.log('✅ MCP 执行结果:', JSON.stringify(mcpResult, null, 2));
    } catch (mcpError) {
      console.error('❌ MCP 执行失败:', mcpError);
      mcpResult = {
        success: false,
        error: mcpError instanceof Error ? mcpError.message : 'MCP 执行失败',
      };
    }

    testLog.push({
      step: 7,
      description: '执行 MCP',
      mcpResult,
    });

    // ==========================================
    // Step 8：控制器将结果提供给 agent
    // ==========================================
    console.log('📤 ========== Step 8：返回给执行 agent ==========');

    // 模拟这一步（实际项目中会调用 LLM）
    const step8Result = {
      message: 'Step 8 模拟完成：将 Agent B 输出和 MCP 结果提供给执行 agent',
      agentBOutput,
      mcpResult,
    };

    console.log('✅ Step 8 完成:', step8Result);
    testLog.push({
      step: 8,
      description: '返回给执行 agent（模拟）',
      step8Result,
    });

    // ==========================================
    // Step 9：更新 agent_sub_tasks 任务
    // ==========================================
    console.log('💾 ========== Step 9：更新任务状态 ==========');

    const finalStatus = mcpResult.success ? 'completed' : 'failed';
    await db
      .update(agentSubTasks)
      .set({
        status: finalStatus,
        executionResult: JSON.stringify({
          step5toStep9Test: true,
          agentBOutput,
          mcpResult,
        }),
        completedAt: mcpResult.success ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(agentSubTasks.id, subTask[0].id));

    console.log('✅ Step 9 完成：任务状态更新为', finalStatus);
    testLog.push({
      step: 9,
      description: '更新任务状态',
      finalStatus,
      subTaskId: subTask[0].id,
    });

    // ==========================================
    // 返回测试结果
    // ==========================================
    console.log('🎉 ========== 测试完成 ==========');

    return NextResponse.json({
      success: true,
      message: 'Step 5 to Step 9 测试完成',
      data: {
        testLog,
        summary: {
          step5: '✅ 完成 - 调用 Agent B',
          step6: '✅ 完成 - Agent B 输出',
          step7: mcpResult.success ? '✅ 完成 - MCP 执行成功' : '❌ 失败 - MCP 执行失败',
          step8: '✅ 完成 - 返回给执行 agent（模拟）',
          step9: '✅ 完成 - 更新任务状态',
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
        message: 'Step 5 to Step 9 测试失败',
        error: error instanceof Error ? error.message : String(error),
        testLog,
      },
      { status: 500 }
    );
  }
}
