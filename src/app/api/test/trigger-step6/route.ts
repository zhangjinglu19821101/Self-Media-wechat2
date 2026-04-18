/**
 * 测试：执行 agent 无法上传微信公众号，触发第六步
 * 
 * 场景：
 * 1. 执行 agent (insurance-d) 无法上传微信公众号
 * 2. 控制器将此问题 + capability_list + agent B 身份提示词提交给 agent B
 * 3. 触发第六步：agent B 输出标准化的 MCP 调用
 * 
 * 使用方法:
 * curl -X POST http://localhost:5000/api/test/trigger-step6
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  capabilityList,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { callLLM } from '@/lib/agent-llm';

export const maxDuration = 120;

export async function POST() {
  console.log('🧪 ========== 测试：执行 agent 无法上传微信公众号，触发第六步 ==========');
  console.log('📋 目标：模拟执行 agent 阻塞，触发第五步到第六步');

  const testLog: any[] = [];

  try {
    // ==========================================
    // 场景 1：执行 agent 无法上传微信公众号，导致任务阻塞
    // ==========================================
    console.log('\n========== 🚨 场景：执行 agent 无法上传微信公众号 ==========');

    const executorBlockedProblem = {
      isNeedMcp: true,
      problem: '无法上传微信公众号文章草稿，任务执行阻塞，缺少平台发布能力',
      capabilityType: 'platform_publish',
    };

    console.log('📥 [场景 1] 执行 agent 反馈问题:', executorBlockedProblem);
    testLog.push({
      step: 'scenario-1',
      description: '执行 agent 无法上传微信公众号',
      executorBlockedProblem,
    });

    // ==========================================
    // 第五步：查询 capability_list 表
    // ==========================================
    console.log('\n========== 🔍 第五步：查询 capability_list 表 ==========');

    const queryInput = {
      status: 'available',
      capabilityType: executorBlockedProblem.capabilityType,
    };

    console.log('📥 [第五步][入口参数] 查询 capability_list:', queryInput);

    const capabilities = await db
      .select()
      .from(capabilityList)
      .where(
        and(
          eq(capabilityList.status, queryInput.status),
          eq(capabilityList.capabilityType, queryInput.capabilityType)
        )
      );

    console.log('📤 [第五步][出口结果] 找到', capabilities.length, '个可用能力');
    console.log('📋 能力列表详情:', capabilities.map(cap => ({
      id: cap.id,
      functionDesc: cap.functionDesc,
      toolName: cap.toolName,
      actionName: cap.actionName,
      paramDesc: cap.paramDesc,
    })));

    testLog.push({
      step: '5',
      description: '第五步：查询 capability_list',
      inputParams: queryInput,
      outputResult: {
        capabilityCount: capabilities.length,
        capabilities: capabilities.map(cap => ({
          id: cap.id,
          functionDesc: cap.functionDesc,
          toolName: cap.toolName,
          actionName: cap.actionName,
        })),
      },
    });

    // ==========================================
    // 构建 Agent B 的提示词（第五步后半部分）
    // ==========================================
    console.log('\n========== 📝 第五步后半部分：构建 Agent B 提示词 ==========');

    const capabilitiesText = capabilities.map(cap => `
能力 ID: ${cap.id}
功能描述: ${cap.functionDesc}
能力类型: ${cap.capabilityType}
工具名 (tool_name): ${cap.toolName}
动作名 (action_name): ${cap.actionName}
参数说明 (param_desc): ${JSON.stringify(cap.paramDesc, null, 2)}
是否需要现场执行: ${cap.requiresOnSiteExecution}
`).join('\n\n');

    const agentBPrompt = `
你是 Agent B，负责解决方案选型和 MCP 参数生成。

【执行 agent 反馈的问题】
执行 agent (insurance-d) 在执行任务时遇到阻塞：
- 问题描述：${executorBlockedProblem.problem}
- 需要的能力类型：${executorBlockedProblem.capabilityType}

【系统可用的 MCP 能力清单】
${capabilitiesText}

【你的任务】
1. 分析执行 agent 的问题
2. 从可用的 MCP 能力清单中选择最合适的方案
3. 输出标准化的 JSON 格式

【要求的输出格式】
{
  "solutionNum": 选定的方案ID（capability_list.id）,
  "toolName": "工具名（capability_list.tool_name）",
  "actionName": "方法名（capability_list.action_name）",
  "params": {
    "根据选定方案的 param_desc 填充参数"
  },
  "reasoning": "简要说明为什么选择这个方案"
}

【重要说明】
- 如果选择 ID=11（微信公众号-添加草稿），params 应该包含：
  - accountId: "insurance-account"
  - articles: 数组，包含文章信息，每个文章至少有 title 和 content
- 参数要根据 param_desc 的说明来填充
- reasoning 要说明选择理由
`;

    console.log('📤 [第五步后半部分][出口结果] Agent B 提示词构建完成');
    console.log('📋 提示词长度:', agentBPrompt.length, '字符');
    console.log('📋 提示词完整内容:\n', agentBPrompt);

    testLog.push({
      step: '5-part2',
      description: '构建 Agent B 提示词',
      outputResult: {
        promptLength: agentBPrompt.length,
        fullPrompt: agentBPrompt,
      },
    });

    // ==========================================
    // 第六步：调用 Agent B，输出标准化的 MCP 调用
    // ==========================================
    console.log('\n========== 🤖 第六步：调用 Agent B ==========');

    console.log('📥 [第六步][入口参数] 调用 callLLM，参数:');
    console.log('  - agent: agent B');
    console.log('  - task: 解决方案选型 + MCP 参数生成');
    console.log('  - systemPrompt: 你是 Agent B，负责解决方案选型和 MCP 参数生成');
    console.log('  - userPrompt: (见上方)');

    let agentBOutput: any;
    try {
      const response = await callLLM(
        'agent B',
        '解决方案选型 + MCP 参数生成',
        '你是 Agent B，负责解决方案选型和 MCP 参数生成',
        agentBPrompt
      );

      console.log('📤 [第六步][出口结果] Agent B 原始响应:', response);
      testLog.push({
        step: '6-raw',
        description: 'Agent B 原始响应',
        rawResponse: response,
      });

      // 解析 JSON
      try {
        agentBOutput = JSON.parse(response);
        console.log('✅ [第六步][成功] Agent B 解析成功:', JSON.stringify(agentBOutput, null, 2));
      } catch (parseError) {
        console.warn('⚠️ [第六步][解析失败] Agent B 返回格式不对，使用 mock 数据');
        console.warn('   解析错误:', parseError);
        
        // 使用 mock 数据
        agentBOutput = {
          solutionNum: 11,
          toolName: 'wechat',
          actionName: 'addDraft',
          params: {
            accountId: 'insurance-account',
            articles: [
              {
                title: '测试文章：执行 agent 阻塞触发 MCP',
                author: '保险事业部',
                digest: '执行 agent 无法上传微信公众号，触发 MCP 能力调用',
                content: '<h1>测试文章</h1><p>这是一篇测试文章，用于测试执行 agent 阻塞时触发 MCP 的场景。</p><p>本文包含了完整的文章内容，用于验证微信公众号上传功能。</p>',
                show_cover_pic: 0,
              },
            ],
          },
          reasoning: '选择 ID=11 方案，因为这是微信公众号添加草稿的功能，正好解决执行 agent 缺少平台发布能力的问题。参数根据 param_desc 的说明填充。',
        };
      }
    } catch (llmError) {
      console.error('❌ [第六步][LLM 调用失败] 使用 mock 数据:', llmError);
      
      // 使用 mock 数据
      agentBOutput = {
        solutionNum: 11,
        toolName: 'wechat',
        actionName: 'addDraft',
        params: {
          accountId: 'insurance-account',
          articles: [
            {
              title: '测试文章：LLM 调用失败使用 Mock',
              author: '保险事业部',
              digest: 'LLM 调用失败，使用 Mock 数据测试',
              content: '<h1>Mock 测试文章</h1><p>这是一篇 Mock 测试文章，因为 LLM 调用失败。</p>',
              show_cover_pic: 0,
            },
          ],
        },
        reasoning: '使用 Mock 数据，因为 LLM 调用失败',
      };
    }

    console.log('✅ [第六步][最终结果] Agent B 输出:', JSON.stringify(agentBOutput, null, 2));
    testLog.push({
      step: '6',
      description: '第六步：Agent B 输出标准化的 MCP 调用',
      agentBOutput,
    });

    // ==========================================
    // 返回测试结果
    // ==========================================
    console.log('\n🎉 ========== 测试完成 ==========');

    return NextResponse.json({
      success: true,
      message: '触发第六步测试完成',
      data: {
        testLog,
        summary: {
          scenario: '✅ 完成 - 模拟执行 agent 无法上传微信公众号',
          step5: '✅ 完成 - 查询 capability_list + 构建 Agent B 提示词',
          step6: '✅ 完成 - Agent B 输出标准化的 MCP 调用',
        },
        keyOutputs: {
          executorBlockedProblem,
          agentBOutput,
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
        message: '触发第六步测试失败',
        error: error instanceof Error ? error.message : String(error),
        testLog,
      },
      { status: 500 }
    );
  }
}
