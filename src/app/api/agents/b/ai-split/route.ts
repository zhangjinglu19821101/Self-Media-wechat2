import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getWorkspaceId } from '@/lib/auth/context';
import { LLMClient, Config } from 'coze-coding-dev-sdk';
import { createUserLLMClient } from '@/lib/llm/factory';
import { handleRouteError } from '@/lib/api/route-error-handler';
import { loadAgentPrompt } from '@/lib/agents/prompt-loader';
import { getAllFlowTemplates } from '@/lib/agents/flow-templates';

/**
 * 识别任务领域
 * @param instruction 任务指令
 * @returns 领域类型：'insurance' | 'ai' | 'general'
 */
function identifyDomain(instruction: string): 'insurance' | 'ai' | 'general' {
  const lowerInstruction = instruction.toLowerCase();
  
  // 保险领域关键词
  const insuranceKeywords = [
    '保险', 'insurance', '增额寿', '年金', '分红险', '惠民保', '医保',
    '存款', '储蓄', '银行', '理财', '保障', '理赔', '投保'
  ];
  
  // AI 领域关键词
  const aiKeywords = [
    'AI', 'ai', '人工智能', '大模型', 'LLM', 'Agent', '智能体',
    '开发', '技术', '架构', '系统', '程序', '代码', '算法'
  ];
  
  // 检查保险领域
  for (const keyword of insuranceKeywords) {
    if (lowerInstruction.includes(keyword.toLowerCase())) {
      return 'insurance';
    }
  }
  
  // 检查 AI 领域
  for (const keyword of aiKeywords) {
    if (lowerInstruction.includes(keyword.toLowerCase())) {
      return 'ai';
    }
  }
  
  // 默认通用领域
  return 'general';
}

/**
 * 根据领域构建系统提示词（简化版）
 * @param domain 领域类型
 * @param instruction 任务指令
 * @returns 系统提示词
 */
function buildSystemPrompt(domain: 'insurance' | 'ai' | 'general', instruction: string): string {
  // 1. 加载 Agent B 的基础提示词
  let basePrompt = '';
  try {
    basePrompt = loadAgentPrompt('B');
  } catch (error) {
    basePrompt = `你是 Agent B，智能拆解中枢，负责协调各 Agent 之间的协作。`;
  }

  // 2. 根据领域补充提示词
  let domainAddon = '';
  
  if (domain === 'insurance') {
    // 生成平台流程说明
    const flowTemplates = getAllFlowTemplates();
    const flowDescriptions = flowTemplates.map(t => {
      const steps = t.steps.map(s => `  ${s.orderIndex}. [${s.executor}] ${s.title}: ${s.description}`).join('\n');
      return `### ${t.name}（平台: ${t.platform}）\n${steps}`;
    }).join('\n\n');

    domainAddon = `

## 保险领域专项说明

这是一个保险领域的任务。

### 可用 Agent：
- **insurance-d**: 保险内容主编，擅长公众号长文创作（HTML格式输出）
- **insurance-xiaohongshu**: 小红书创作专家，擅长小红书图文创作（JSON格式输出，含卡片预览）
- **insurance-zhihu**: 知乎创作专家，擅长专业深度回答（Markdown格式输出）
- **insurance-toutiao**: 头条创作专家，擅长信息流文章（标题党+短段落+强节奏）
- **insurance-c**: 保险运营，擅长公众号运营推广（上传草稿箱等）
- **B**: 你自己，协调者
- **A**: 战略决策者

### 各平台标准流程模板（重要！请根据指令内容选择合适的流程）

${flowDescriptions}

### 流程选择规则：
1. 如果指令涉及"小红书"相关 → 使用小红书图文创作流程（executor 使用 insurance-xiaohongshu）
2. 如果指令涉及"公众号"/"微信" → 使用公众号文章创作流程（executor 使用 insurance-d + insurance-c）
3. 如果指令涉及"知乎" → 使用知乎文章创作流程
4. 如果指令涉及"抖音"/"短视频" → 使用抖音短视频脚本创作流程
5. 如果指令未指定平台 → 默认使用公众号文章创作流程
6. **小红书流程没有运营步骤**，最后一步是"内容预览与确认"，不需要 insurance-c
`;
  } else if (domain === 'ai') {
    domainAddon = `

## AI/技术领域专项说明

这是一个 AI 或技术开发领域的任务。

### 可用 Agent：
- **B**: 你自己，技术官，擅长技术架构
- **D**: 内容创作者
- **C**: 数据分析师
- **A**: 战略决策者
`;
  }

  // 3. 组合最终提示词
  return `${basePrompt}
${domainAddon}

---

## 任务指令

${instruction}

---

## 你的任务

请将上述任务拆解为多个子任务，分配给合适的 Agent 协作执行。

## 输出格式

只返回纯 JSON：

\`\`\`json
{
  "subTasks": [
    {
      "title": "子任务标题",
      "description": "详细描述",
      "executor": "Agent ID",
      "orderIndex": 1
    }
  ]
}
\`\`\`

## 要求

- executor 只能是：A、B、C、D、insurance-c、insurance-d、insurance-xiaohongshu
- orderIndex 从 1 开始
- **子任务描述（description）必须非常详细具体**，包含：
  - 明确的任务目标和预期结果
  - 具体的执行步骤或方法
  - 必要的约束条件和限制
  - 不要只写一句话，要写清楚完整的执行指南
- 只返回 JSON，不要其他文字
`;
}

/**
 * POST /api/agents/b/ai-split
 * AI 智能拆解任务接口（Agent B 作为智能拆解中枢）
 */
export async function POST(request: NextRequest) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const body = await request.json();
    const { instruction } = body;

    if (!instruction) {
      return NextResponse.json(
        { success: false, error: '指令不能为空' },
        { status: 400 }
      );
    }

    console.log(`🤖 [AI-Split] 开始拆解任务，指令长度: ${instruction.length}`);

    // 1. 识别任务领域
    const domain = identifyDomain(instruction);
    console.log(`🎯 [AI-Split] 识别到的领域: ${domain}`);

    // 2. 根据领域构建系统提示词
    const systemPrompt = buildSystemPrompt(domain, instruction);
    console.log(`📝 [AI-Split] 系统提示词长度: ${systemPrompt.length}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📋 [AI-Split] 完整提示词内容：`);
    console.log(systemPrompt);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // 3. 初始化 LLM 客户端（BYOK：优先使用用户 Key）
    const workspaceId = await getWorkspaceId(request);
    const { client: llmClient } = await createUserLLMClient(workspaceId);

    console.log(`🤖 [AI-Split] 调用 LLM 进行任务拆解...`);

    // 4. 调用 LLM（流式，但读取完整响应）
    const llmStream = llmClient.stream([
      { role: 'system', content: systemPrompt },
    ], {
      temperature: 0.3,
    });

    let llmOutput = '';
    for await (const chunk of llmStream) {
      if (chunk.content) {
        llmOutput += chunk.content.toString();
      }
    }

    console.log(`✅ [AI-Split] LLM 响应完成，长度: ${llmOutput.length}`);

    // 5. 解析 LLM 输出
    let parsedResult;
    try {
      // 尝试从输出中提取 JSON
      const jsonMatch = llmOutput.match(/```[\s\S]*?json([\s\S]*?)```/) || 
                         llmOutput.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        parsedResult = JSON.parse(jsonStr.trim());
      } else {
        // 直接尝试解析整个输出
        parsedResult = JSON.parse(llmOutput.trim());
      }
    } catch (parseError) {
      console.error(`❌ [AI-Split] JSON 解析失败:`, parseError);
      console.error(`❌ [AI-Split] LLM 原始输出:`, llmOutput);
      
      // 降级方案：创建一个默认的子任务
      parsedResult = {
        subTasks: [
          {
            title: "执行主任务",
            description: instruction.substring(0, 500) + (instruction.length > 500 ? "..." : ""),
            executor: "B",
            orderIndex: 1
          }
        ]
      };
    }

    // 6. 验证和清洗结果
    if (!parsedResult.subTasks || !Array.isArray(parsedResult.subTasks)) {
      parsedResult.subTasks = [];
    }

    // 确保每个子任务都有必需的字段
    const validSubTasks = parsedResult.subTasks
      .filter((task: any) => task && task.title)
      .map((task: any, index: number) => ({
        title: task.title || '未命名任务',
        description: task.description || '',
        executor: task.executor || 'B',
        orderIndex: task.orderIndex || (index + 1)
      }));

    console.log(`✅ [AI-Split] 成功拆解出 ${validSubTasks.length} 个子任务`);
    console.log(`📋 [AI-Split] 拆解结果:`, validSubTasks);

    // 自动生成任务标题（从指令中提取或生成）
    let generatedTaskTitle = 'AI 拆解任务';
    // 从指令中提取前30个字作为任务标题
    generatedTaskTitle = instruction.substring(0, 30).replace(/[\n\r]/g, ' ').trim();
    if (generatedTaskTitle.length > 30) {
      generatedTaskTitle = generatedTaskTitle.substring(0, 27) + '...';
    }
    if (!generatedTaskTitle) {
      generatedTaskTitle = 'AI 拆解任务';
    }

    return NextResponse.json({
      success: true,
      subTasks: validSubTasks,
      domain: domain, // 返回识别到的领域
      systemPrompt: systemPrompt, // 返回完整的提示词内容
      generatedTaskTitle: generatedTaskTitle, // 返回自动生成的任务标题
    });

  } catch (error: any) {
    console.error('❌ [AI-Split] Error:', error);
    return handleRouteError(error, 'AI 拆解失败');
  }
}
