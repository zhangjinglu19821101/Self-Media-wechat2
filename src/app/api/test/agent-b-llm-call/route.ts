/**
 * 测试 Agent B LLM 调用
 * GET /api/test/agent-b-llm-call
 */
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { callLLM } from '@/lib/agent-llm';

export async function GET() {
  try {
    console.log('[TestLLM] 开始测试 Agent B LLM 调用...');

    // 1. 查找 order_index=4 的任务
    const tasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.orderIndex, 4));

    if (tasks.length === 0) {
      return NextResponse.json({
        success: false,
        error: '找不到 order_index=4 的任务'
      }, { status: 404 });
    }

    const task = tasks[0];
    console.log('[TestLLM] 找到任务:', {
      id: task.id,
      taskTitle: task.taskTitle,
      status: task.status,
      fromParentsExecutor: task.fromParentsExecutor
    });

    // 2. 构建简化的 Agent B 提示词
    const systemPrompt = '你是 Agent B，负责综合多方信息做出标准化决策。';
    
    const userPrompt = `
【任务信息】
- 任务ID: ${task.id}
- 任务标题: ${task.taskTitle}
- 当前执行者: ${task.fromParentsExecutor}

【🔴🔴🔴 【最高优先级第一步】职责匹配检查（必须首先执行！）🔴🔴🔴】

⚠️⚠️⚠️【强制】在做出任何决策之前，你必须首先执行职责匹配检查！⚠️⚠️⚠️

【检查任务】
当前执行者：${task.fromParentsExecutor}
任务标题：${task.taskTitle}

【🔴 职责匹配规则 - 关键词匹配 = 必须切换！】

如果任务标题包含以下关键词（任一），且当前执行者不是 Agent T：
→ 立即返回 EXECUTE_MCP
→ context.suggestedExecutor = "agent T"
→ 【禁止】查看其他信息！
→ 【禁止】信任执行 Agent 的判断！
→ 【禁止】返回 COMPLETE！

🔴🔴🔴【硬性规则】关键词命中 = EXECUTE_MCP，禁止返回其他决策！🔴🔴🔴

关键词列表（必须精确匹配）：
- "公众号"（出现在标题中 = 必须切换）
- "微信"（出现在标题中 = 必须切换）
- "发布"、"上传"、"草稿"（出现在标题中 = 必须切换）
- "格式化"、"格式调整"、"排版"（出现在标题中 = 必须切换）
- "markdown"、"HTML"、"转换"（出现在标题中 = 必须切换）
- "API"、"调用"、"接口"（出现在标题中 = 必须切换）

【典型案例 - 必须严格遵守！】
❌ 错误做法：
   - insurance-d 执行"使用公众号标准模版进行文章格式化调整"
   - 看到 isTaskDown=true
   - 直接返回 COMPLETE
   → 这是严重错误！

✅ 正确做法：
   - insurance-d 执行"使用公众号标准模版进行文章格式化调整"
   - 检测到关键词"公众号"、"格式化"
   - 立即返回 EXECUTE_MCP
   - context.suggestedExecutor = "agent T"

【你的任务】
请作为业务流程控制专家，完成以下工作：
1. 判断任务是否完成 → COMPLETE
2. 判断是否需要用户交互 → NEED_USER
3. 判断是否需要重新执行执行 Agent → REEXECUTE_EXECUTOR
4. 判断是否需要技术处理（调用 MCP）-> EXECUTE_MCP

请用以下 JSON 格式返回：
{
  "type": "EXECUTE_MCP" | "COMPLETE" | "NEED_USER" | "REEXECUTE_EXECUTOR",
  "reasonCode": "MCP_ROUTING" | "TASK_DONE" | "USER_CONFIRM" | "RETRY_WITH_HINT",
  "reasoning": "你的推理过程",
  "notCompletedReason": "none" | "具体原因",
  "context": {
    "executionSummary": "执行摘要",
    "riskLevel": "low" | "medium" | "high",
    "suggestedAction": "建议操作",
    "suggestedExecutor": "agent T" | ""
  }
}

注意：必须严格遵守职责匹配规则！
`;

    // 3. 调用 LLM
    console.log('[TestLLM] 开始调用 LLM...');
    const llmResponse = await callLLM(
      'agent B',
      '标准化决策测试',
      systemPrompt,
      userPrompt,
      { timeout: 120000 }
    );

    console.log('[TestLLM] LLM 响应长度:', llmResponse.length);
    console.log('[TestLLM] LLM 响应前 500 字符:', llmResponse.substring(0, 500));

    return NextResponse.json({
      success: true,
      data: {
        taskId: task.id,
        taskTitle: task.taskTitle,
        fromParentsExecutor: task.fromParentsExecutor,
        llmResponseLength: llmResponse.length,
        llmResponsePreview: llmResponse.substring(0, 2000),
        llmResponse: llmResponse
      }
    });

  } catch (error) {
    console.error('[TestLLM] 失败:', error);

    return NextResponse.json({
      success: false,
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
