import { NextRequest, NextResponse } from 'next/server';
import { callLLM } from '@/lib/agent-llm';
import {
  AGENT_B_BUSINESS_CONTROLLER_SYSTEM_PROMPT,
  buildAgentBBusinessControllerUserPrompt,
  AGENT_B_OUTPUT_FORMAT
} from '@/lib/agents/prompts/agent-b-business-controller';

// ========== 场景定义 ==========
const SCENARIOS = [
  {
    id: 'scenario-1',
    name: '执行 agent 返回 needsMcpSupport=true',
    description: '执行 agent 明确说需要 MCP 技术支持',
    taskTitle: '文章内容优化',
    taskDescription: '优化这篇保险文章的内容',
    executorResponse: {
      isCompleted: false,
      needsMcpSupport: true,
      mcpSupportReason: '需要先进行内容合规检查，才能继续优化',
      content: '我需要 MCP 技术支持来进行合规检查',
    },
    priorStepOutput: '# 重疾险产品介绍\n\n这是一篇保险产品介绍文章...'
  },
  {
    id: 'scenario-2',
    name: '执行 agent 返回 isCompleted=true（非合规任务）',
    description: '执行 agent 说完成了，且不是合规任务',
    taskTitle: '文章内容优化',
    taskDescription: '优化这篇保险文章的内容',
    executorResponse: {
      isCompleted: true,
      needsMcpSupport: false,
      content: '文章内容优化完成！',
    },
    priorStepOutput: '# 重疾险产品介绍（优化版）\n\n这是优化后的文章...'
  },
  {
    id: 'scenario-3',
    name: '执行 agent 返回 isCompleted=true 但是合规任务',
    description: '即使执行 agent 说完成了，合规任务仍需要 MCP',
    taskTitle: '合规校验文章',
    taskDescription: '对文章进行合规校验',
    executorResponse: {
      isCompleted: true,
      needsMcpSupport: false,
      content: '我看完了，文章没问题',
    },
    priorStepOutput: '# 重疾险产品介绍\n\n这是一篇保险产品介绍文章...'
  },
  {
    id: 'scenario-4',
    name: '执行 agent 返回 pre_completed',
    description: '执行 agent 说搞定了（pre_completed 状态）',
    taskTitle: '文章内容优化',
    taskDescription: '优化这篇保险文章的内容',
    executorResponse: {
      isCompleted: false,
      needsMcpSupport: false,
      content: 'pre_completed',
    },
    priorStepOutput: '# 重疾险产品介绍（优化版）\n\n这是优化后的文章...'
  },
  {
    id: 'scenario-5',
    name: '执行 agent 返回 hasException=true',
    description: '执行 agent 遇到异常',
    taskTitle: '文章内容优化',
    taskDescription: '优化这篇保险文章的内容',
    executorResponse: {
      isCompleted: false,
      needsMcpSupport: false,
      hasException: true,
      exceptionMessage: '无法理解文章内容',
      content: '我遇到了问题：无法理解文章内容',
    },
    priorStepOutput: '# 重疾险产品介绍\n\n这是一篇保险产品介绍文章...'
  },
  {
    id: 'scenario-6',
    name: '普通任务，执行 agent 需要技术支持',
    description: '执行 agent 明确说需要技术支持',
    taskTitle: '图片生成',
    taskDescription: '为文章生成一张配图',
    executorResponse: {
      isCompleted: false,
      needsMcpSupport: true,
      mcpSupportReason: '需要调用图片生成工具',
      content: '我需要 MCP 技术支持来生成图片',
    },
    priorStepOutput: '# 重疾险产品介绍\n\n这是一篇保险产品介绍文章...'
  },
  {
    id: 'scenario-7',
    name: '执行 agent 说完成了，但任务需要 MCP',
    description: '执行 agent 说完成了，但任务本质上需要 MCP 支持',
    taskTitle: '内容审核',
    taskDescription: '审核这篇文章的内容',
    executorResponse: {
      isCompleted: true,
      needsMcpSupport: false,
      content: '我看完了，内容没问题',
    },
    priorStepOutput: '# 重疾险产品介绍\n\n这是一篇保险产品介绍文章...'
  },
  {
    id: 'scenario-8',
    name: '执行 agent 说需要 MCP 但任务已完成',
    description: '执行 agent 说需要 MCP，但任务其实已经完成了',
    taskTitle: '文章内容优化',
    taskDescription: '优化这篇保险文章的内容',
    executorResponse: {
      isCompleted: true,
      needsMcpSupport: true,
      mcpSupportReason: '可以再优化一下',
      content: '文章优化完成！不过还可以用 MCP 再优化一下',
    },
    priorStepOutput: '# 重疾险产品介绍（优化版）\n\n这是优化后的文章...'
  },
  {
    id: 'scenario-order4',
    name: '【关键测试】insurance-d 执行"使用公众号标准模版进行文章格式化调整"',
    description: '测试 Agent B 是否能正确识别关键词并返回 EXECUTE_MCP',
    taskTitle: '使用公众号标准模版进行文章格式化调整',
    taskDescription: '将文章格式化为微信公众号标准格式',
    executorResponse: {
      isCompleted: true,
      needsMcpSupport: false,
      isTaskDown: true,
      canComplete: true,
      reasoning: 'insurance-d认为可以直接完成公众号格式调整',
      content: '已完成公众号格式调整，排版适配手机阅读'
    },
    executor: 'insurance-d',
    priorStepOutput: '# 30万存款到期怎么存？\n\n最近不少朋友的定期存款到期了...'
  }
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scenarioId = searchParams.get('scenario');
  const mode = searchParams.get('mode') || 'full'; // 'full' | 'prompt' | 'list'
  
  console.log('[Test API] Agent B 所有场景模拟测试');
  console.log('[Test API] 模式:', mode);
  console.log('[Test API] 场景:', scenarioId || '所有场景');

  try {
    // ========== 模式1：列出所有场景 ==========
    if (mode === 'list') {
      return NextResponse.json({
        mode: 'list',
        scenarios: SCENARIOS.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          taskTitle: s.taskTitle
        }))
      });
    }

    // ========== 确定要测试的场景 ==========
    const scenariosToTest = scenarioId 
      ? SCENARIOS.filter(s => s.id === scenarioId)
      : SCENARIOS;

    if (scenariosToTest.length === 0) {
      return NextResponse.json({
        error: `找不到场景: ${scenarioId}`,
        availableScenarios: SCENARIOS.map(s => s.id)
      }, { status: 400 });
    }

    // ========== 模式2：只返回提示词 ==========
    if (mode === 'prompt') {
      const prompts = scenariosToTest.map(scenario => {
        const prompt = buildAgentBPrompt(scenario);
        return {
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          prompt: prompt
        };
      });
      
      return NextResponse.json({
        mode: 'prompt',
        count: prompts.length,
        prompts: prompts
      });
    }

    // ========== 模式3：完整测试（调用 LLM） ==========
    console.log('[Test API] 开始测试', scenariosToTest.length, '个场景...');
    
    const results = [];
    
    for (const scenario of scenariosToTest) {
      console.log(`[Test API] 测试场景: ${scenario.id} - ${scenario.name}`);
      
      const result = await testScenario(scenario);
      results.push(result);
      
      // 延迟一下，避免 LLM 限流
      if (scenariosToTest.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // ========== 总结分析 ==========
    const summary = analyzeResults(results);

    return NextResponse.json({
      mode: 'full',
      success: true,
      summary: summary,
      results: results
    });

  } catch (error) {
    console.error('[Test API] 测试失败:', error);
    return NextResponse.json({
      error: '测试失败',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

// ========== 辅助函数 ==========

function buildAgentBPrompt(scenario: typeof SCENARIOS[0]) {
  const isComplianceTask = scenario.taskTitle.includes('合规') || scenario.taskTitle.includes('审核');
  const executorFeedbackJson = JSON.stringify(scenario.executorResponse, null, 2);
  
  const capabilitiesText = `
能力 ID: 20
功能描述: 微信公众号内容合规审核（RAG + LLM）
能力类型: mcp
工具名 (tool_name): wechat_official_account_tools
动作名 (action_name): check_content_compliance
参数说明 (param_desc): {"accountId": "保险公众号账号ID", "content": "要检查的文章内容"}

能力 ID: 21
功能描述: 微信公众号内容合规审核（快速检查）
能力类型: mcp
工具名 (tool_name): wechat_official_account_tools
动作名 (action_name): quick_compliance_check
参数说明 (param_desc): {"accountId": "保险公众号账号ID", "content": "要检查的文章内容"}

能力 ID: 22
功能描述: 图片生成
能力类型: mcp
工具名 (tool_name): image_tools
动作名 (action_name): generate_image
参数说明 (param_desc): {"prompt": "图片描述", "size": "图片尺寸"}
`;

  const executorOutputText = `
【执行 Agent 输出】
\`\`\`json
${executorFeedbackJson}
\`\`\`
`;

  const priorStepOutputText = `
【上一步骤输出】
${scenario.priorStepOutput}
`;

  const userPrompt = buildAgentBBusinessControllerUserPrompt(
    {
      id: scenario.id,
      taskTitle: scenario.taskTitle,
      orderIndex: isComplianceTask ? 2 : 1, // 合规任务是 orderIndex=2
      fromParentsExecutor: 'insurance-d'
    },
    {
      taskMeta: {
        taskId: scenario.id,
        iterationCount: 1,
        maxIterations: 5,
        taskTitle: scenario.taskTitle
      },
      executorFeedback: {
        originalTask: scenario.taskDescription,
        problem: scenario.executorResponse.content || '执行 agent 反馈',
        suggestedApproach: scenario.executorResponse.needsMcpSupport ? 'MCP 技术支持' : undefined
      }
    },
    capabilitiesText,
    '', // mcpHistoryText
    '', // userFeedbackText
    executorOutputText,
    priorStepOutputText,
    'insurance-test-account'
  );

  return AGENT_B_BUSINESS_CONTROLLER_SYSTEM_PROMPT + '\n\n' + userPrompt + '\n\n' + AGENT_B_OUTPUT_FORMAT;
}

async function testScenario(scenario: typeof SCENARIOS[0]) {
  const startTime = Date.now();
  
  try {
    // 1. 构建提示词
    const prompt = buildAgentBPrompt(scenario);
    
    // 2. 调用 LLM
    console.log(`[Test API] [${scenario.id}] 调用 LLM...`);
    const llmResponse = await callLLM(
      'Agent B',
      scenario.name,
      '你是 Agent B，负责综合多方信息做出标准化决策',
      prompt
    );
    
    // 3. 解析决策
    let decision;
    let parseError = null;
    
    try {
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        decision = JSON.parse(jsonMatch[0]);
      } else {
        decision = JSON.parse(llmResponse);
      }
    } catch (e) {
      parseError = e instanceof Error ? e.message : String(e);
      console.error(`[Test API] [${scenario.id}] 决策解析失败:`, parseError);
    }
    
    // 4. 判断结果
    const expectedDecision = getExpectedDecision(scenario);
    const actualDecision = decision?.type || 'PARSE_FAILED';
    const isCorrect = actualDecision === expectedDecision;
    
    const duration = Date.now() - startTime;
    
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      description: scenario.description,
      success: true,
      duration: duration,
      isCorrect: isCorrect,
      expectedDecision: expectedDecision,
      actualDecision: actualDecision,
      decision: decision,
      parseError: parseError,
      rawLLMResponse: llmResponse,
      scenario: scenario
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      description: scenario.description,
      success: false,
      duration: duration,
      error: error instanceof Error ? error.message : String(error),
      scenario: scenario
    };
  }
}

function getExpectedDecision(scenario: typeof SCENARIOS[0]) {
  const { taskTitle, executorResponse } = scenario;
  const isComplianceTask = taskTitle.includes('合规') || taskTitle.includes('审核');
  
  // 规则1: 如果执行 agent 返回 needsMcpSupport=true → EXECUTE_MCP
  if (executorResponse.needsMcpSupport) {
    return 'EXECUTE_MCP';
  }
  
  // 规则2: 如果是合规任务 → EXECUTE_MCP（即使执行 agent 说完成了）
  if (isComplianceTask) {
    return 'EXECUTE_MCP';
  }
  
  // 规则3: 如果执行 agent 返回 isCompleted=true → COMPLETE
  if (executorResponse.isCompleted) {
    return 'COMPLETE';
  }
  
  // 规则4: 如果执行 agent 返回 pre_completed → COMPLETE
  if (executorResponse.content === 'pre_completed') {
    return 'COMPLETE';
  }
  
  // 规则5: 如果有异常 → NEED_USER 或 FAILED（根据情况）
  if (executorResponse.hasException) {
    return 'NEED_USER';
  }
  
  // 默认: 需要看具体情况
  return 'EXECUTE_MCP';
}

function analyzeResults(results: any[]) {
  const total = results.length;
  const successful = results.filter(r => r.success).length;
  const correct = results.filter(r => r.isCorrect).length;
  const failed = results.filter(r => !r.success).length;
  
  const byScenario = results.map(r => ({
    scenarioId: r.scenarioId,
    scenarioName: r.scenarioName,
    success: r.success,
    correct: r.isCorrect,
    expected: r.expectedDecision,
    actual: r.actualDecision,
    duration: r.duration
  }));
  
  return {
    total,
    successful,
    failed,
    correct,
    accuracy: total > 0 ? ((correct / total) * 100).toFixed(1) + '%' : 'N/A',
    byScenario
  };
}
