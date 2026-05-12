import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { capabilityList, agentSubTasks } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { callLLM } from '@/lib/agent-llm';
import { genericMCPCall } from '@/lib/mcp/generic-mcp-call';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testMode = searchParams.get('mode') || 'full'; // 'full' | 'prompt' | 'decision'
  
  console.log('[Test API] 开始测试 Agent B 决策 + MCP 调用流程');
  console.log('[Test API] 测试模式:', testMode);

  try {
    // ========== 步骤1：查询 capability_list 数据 ==========
    console.log('[Test API] ========== 步骤1：查询 capability_list ==========');
    let capabilities = await db
      .select()
      .from(capabilityList)
      .where(eq(capabilityList.status, 'available'))
      .limit(20);
    
    // 🔥 优先排序：把真实的合规审核能力（ID=20,21）放在最前面！
    capabilities = capabilities.sort((a, b) => {
      const priorityA = (a.id === 20 || a.id === 21) ? 0 : (a.id === 1 ? 2 : 1);
      const priorityB = (b.id === 20 || b.id === 21) ? 0 : (b.id === 1 ? 2 : 1);
      return priorityA - priorityB;
    });
    
    console.log('[Test API] 找到 capability 数量:', capabilities.length);
    
    if (capabilities.length === 0) {
      return NextResponse.json({
        error: '没有可用的 capability',
        step: 'query_capabilities'
      }, { status: 400 });
    }

    // ========== 步骤2：查询测试用的文章内容 ==========
    console.log('[Test API] ========== 步骤2：查询测试文章 ==========');
    const testTask = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.orderIndex, 1)) // 找一个 order_index=1 的任务（文章初稿）
      .orderBy(desc(agentSubTasks.id))
      .limit(1);
    
    // 使用真实的保险文章内容
    let testArticleContent = `
# 重疾险产品介绍

重大疾病保险是一种能够为被保险人提供重大疾病保障的保险产品。当被保险人被确诊患有保险合同约定的重大疾病时，保险公司将按照合同约定给付保险金。

## 产品特色

1. **保障全面**：涵盖100种重大疾病，包括恶性肿瘤、急性心肌梗塞、脑中风后遗症等
2. **赔付比例高**：确诊即赔，最高可赔付300%基本保额
3. **保费实惠**：性价比高，每天仅需几块钱
4. **理赔快速**：资料齐全，3天内赔付

## 投保案例

王先生，30岁，投保50万基本保额，20年交：
- 年交保费：6500元
- 保障期限：终身
- 等待期：90天

等待期后，王先生不幸确诊白血病，可获得150万赔付（300%保额）。

## 常见问题

**Q: 这个保险是最好的吗？**
A: 是的，这是市场上最好的重疾险产品，理赔速度最快，保障最全面。

**Q: 保险公司会倒闭吗？**
A: 不会，我们的保险公司绝对不会倒闭，你可以放心投保。

立即投保，给您和家人最全面的保障！
`;
    
    if (testTask.length > 0 && testTask[0].executionResult) {
      try {
        const execResult = JSON.parse(testTask[0].executionResult);
        if (execResult.result) {
          testArticleContent = typeof execResult.result === 'string' 
            ? execResult.result 
            : JSON.stringify(execResult.result);
        }
      } catch (e) {
        console.log('[Test API] 解析测试文章失败，使用默认内容');
      }
    }
    
    console.log('[Test API] 测试文章内容长度:', testArticleContent.length);
    console.log('[Test API] 测试文章前200字符:', testArticleContent.substring(0, 200));

    // ========== 步骤3：构建 Agent B 提示词 ==========
    console.log('[Test API] ========== 步骤3：构建 Agent B 提示词 ==========');
    
    const capabilitiesText = capabilities.map(cap => 
`能力 ID: ${cap.id}
功能描述: ${cap.functionDesc}
能力类型: ${cap.capabilityType}
工具名 (tool_name): ${cap.toolName}
动作名 (action_name): ${cap.actionName}
参数说明 (param_desc): ${JSON.stringify(cap.paramDesc, null, 2)}
输出样例 (example_output): ${cap.example_output ? JSON.stringify(cap.example_output, null, 2) : '无'}`
    ).join('\n\n');

    const defaultAccountId = 'insurance-account';
    
    const prompt = 
`【🔴 🔴 🔴 合规审核任务专用规则】
- 这是一个合规校验任务！
- **必须优先选择 ID=20 或 ID=21 的真实合规审核能力！**
  - ID=20：微信公众号内容合规审核（RAG + LLM）
  - ID=21：微信公众号内容合规审核（快速检查）
- **绝对不要选择 ID=1 的测试用能力！**
- 必须将文章内容作为参数传入！

你是 Agent B，技术专家，重点负责 MCP 的执行与执行 Agent 指令进展的跟进。

【🔴 核心定位 - 重中之重！】
1. **你是纯技术专家，绝对不是业务审核者！**
2. **你的唯一职责：技术层面的 MCP 执行支持和进度跟踪**
3. **绝对不参与业务内容判断、内容审核、质量评估等**
4. **业务层面 100% 信任执行 Agent 和用户的判断**

【🔴 决策优先级（从高到低，绝对严格遵守！）】
1. **用户意见 > 一切**：如果用户已经表态，完全尊重用户的决定，不要质疑
2. **执行 Agent 意见 > 你的判断**：执行 Agent 是业务专家，100% 相信它的专业判断
3. **最后才是你的技术判断**：仅在技术层面提供 MCP 执行支持

【🔴 关键原则 - 必须严格遵守！】
- ✅ **如果执行 Agent 返回 isCompleted=true → 直接输出 COMPLETE，不要任何质疑！**
- ✅ **如果执行 Agent 说完成了 → 直接 COMPLETE，不要审核内容！**
- ✅ **如果任务状态是 pre_completed → 直接 COMPLETE，完全信任执行 Agent！**
- ✅ 用户说没问题了 → 直接 COMPLETE（不质疑）
- ✅ 执行 Agent 需要技术帮助 → 分析能否通过 MCP 解决
- ✅ **如果【上一步骤输出】中有内容，执行 MCP 时必须将其作为参数传递！**
- ❌ **绝对不要对业务内容指手画脚！**
- ❌ **绝对不要进行内容审核、质量评估等业务判断！**
- ❌ 不要重复询问用户同样的问题
- ❌ 不要为了"审核"而审核

【任务信息】
- 任务ID: test-task-001
- 当前轮次: 1/5
- 任务标题: 合规校验测试文章
- 任务描述: 对文章进行合规校验

【执行Agent反馈】
- 原始任务: 合规校验测试文章
- 遇到的问题: 需要对文章进行合规校验
- 建议方案: compliance_check

【🔴 上一步骤输出（重要！）】
${testArticleContent}

【系统可用的 MCP 能力清单】
${capabilitiesText}

【你的任务】
基于以上信息，从**技术层面**分析当前任务状态，输出标准化决策JSON。

【决策类型说明】
1. EXECUTE_MCP - 需要执行MCP（首次执行、重试、切换方案）
2. COMPLETE - 任务已完成，可以结束
3. NEED_USER - 需要用户介入确认/选择
4. FAILED - 任务无法继续，标记失败

【🔴 具体判断逻辑 - 按优先级顺序】
1. **🔴 🔴 🔴 最高优先级：如果是合规校验任务（任务标题含"合规"或"审核"）**：
   - **必须执行 MCP 进行合规校验！绝对不能直接 COMPLETE！**
   - 必须从可用能力中选择合规校验相关的 capability（如 check_compliance、content_review 等）
   - 必须将【上一步骤输出】作为 content 参数传入
   - 即使执行Agent说完成了，也必须先执行合规校验 MCP！

2. **🔴 最高优先级：如果执行 Agent 返回 isCompleted=true**（非合规校验任务）：
   - 直接输出 COMPLETE！不要任何质疑！不要审核内容！
   - 这是最高优先级，超过其他所有判断！

3. **如果有用户反馈**：
   - 用户说"完成了"、"没问题" → COMPLETE
   - 用户确认继续 → COMPLETE 或 EXECUTE_MCP（根据情况）
   - 不要重复问用户同样的问题

4. **如果是 pre_completed 状态（执行Agent说搞定了）**（非合规校验任务）：
   - 直接 COMPLETE（100% 信任执行Agent）
   - 除非有明显的技术问题，否则绝对不质疑

5. **如果执行Agent需要技术帮助**：
   - 分析能否通过 MCP 解决 → EXECUTE_MCP
   - 如果确实需要用户确认关键信息 → NEED_USER

6. **如果多次 MCP 执行失败且不可恢复**：
   - FAILED

【reasonCode编码规范】
- EXECUTE_MCP类型: MCP_CONTINUE, MCP_RETRY, MCP_NEXT_STEP
- COMPLETE类型: TASK_DONE, NO_MCP_NEEDED, TRUST_EXECUTOR
- NEED_USER类型: USER_CONFIRM, USER_SELECT
- FAILED类型: MAX_RETRY_EXCEEDED, MCP_ERROR_UNRECOVERABLE, CAPABILITY_NOT_FOUND

【要求的输出格式】
{
  "type": "EXECUTE_MCP" | "COMPLETE" | "NEED_USER" | "FAILED",
  "reasonCode": "...",
  "reasoning": "详细说明决策理由",
  "context": {
    "executionSummary": "执行摘要",
    "riskLevel": "low" | "medium" | "high",
    "suggestedAction": "建议控制器执行的操作"
  },
  "data": {
    "mcpParams": {
      "solutionNum": 选定的方案ID（从MCP能力清单中选择）,
      "toolName": "工具名（与选定的MCP能力完全一致）",
      "actionName": "方法名（与选定的MCP能力完全一致）",
      "params": {
        "accountId": "${defaultAccountId}",
        "content": "文章内容",
        "articleContent": "文章内容",
        "text": "文章内容",
        "priorStepOutput": "文章内容"
      }
    }
  }
}

【重要规则 - 必须严格遵守！】
1. **🔴 🔴 🔴 绝对必须遵守：合规校验任务必须执行 MCP！**
   - 只要任务标题包含"合规"或"审核"，必须先执行 MCP
   - 不能因为执行Agent说完成了就跳过合规校验
   - 必须选择合规校验相关的 capability
   - 必须将【上一步骤输出】作为参数传入
2. **🔴 最高优先级规则（非合规校验任务）：如果执行 Agent 返回 isCompleted=true → 直接输出 COMPLETE！**
3. **🔴 绝对不允许：对业务内容进行审核、评估、质疑！**
4. 必须严格按照上述 JSON 格式输出
5. 基于MCP历史分析：如果多次失败且不可恢复，应输出FAILED
6. 如果任务目标已达成，输出COMPLETE
7. 如果需要用户确认关键信息，输出NEED_USER
8. **关键：params.accountId 必须使用: ${defaultAccountId}**
9. 只输出 JSON，不要输出其他任何文字说明
10. **特别强调：实事求是，基于执行Agent的反馈做判断！**
11. **特别强调：对于 pre_completed 状态，优先信任执行Agent，优先输出 COMPLETE！**（非合规校验任务）
12. **⚠️  ⚠️  ⚠️  最高优先级（除合规校验外）：用户反馈 > 执行Agent反馈 > 你的主观判断！**
13. **如果有用户反馈，必须优先尊重用户的决定，不要重复询问用户！**
`;

    console.log('[Test API] 提示词构建完成，长度:', prompt.length);
    
    if (testMode === 'prompt') {
      return NextResponse.json({
        mode: 'prompt',
        capabilitiesCount: capabilities.length,
        articleLength: testArticleContent.length,
        promptPreview: prompt.substring(0, 2000) + '...',
        fullPrompt: prompt
      });
    }

    // ========== 步骤4：调用 LLM 获取决策 ==========
    console.log('[Test API] ========== 步骤4：调用 LLM ==========');
    
    const llmResponse = await callLLM(
      'agent B',
      '合规校验决策测试',
      '你是 Agent B，负责综合多方信息做出标准化决策',
      prompt
    );
    
    console.log('[Test API] LLM 原始响应:', llmResponse);
    
    let decision;
    try {
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        decision = JSON.parse(jsonMatch[0]);
      } else {
        decision = JSON.parse(llmResponse);
      }
      console.log('[Test API] 决策解析成功:', JSON.stringify(decision, null, 2));
    } catch (e) {
      console.error('[Test API] 决策解析失败:', e);
      return NextResponse.json({
        error: 'LLM 响应解析失败',
        rawResponse: llmResponse,
        step: 'parse_decision'
      }, { status: 400 });
    }
    
    if (testMode === 'decision') {
      return NextResponse.json({
        mode: 'decision',
        capabilitiesCount: capabilities.length,
        articleLength: testArticleContent.length,
        rawResponse: llmResponse,
        decision: decision
      });
    }

    // ========== 步骤5：验证决策并准备执行 MCP ==========
    console.log('[Test API] ========== 步骤5：验证决策 ==========');
    
    let validationResult = {
      isValid: true,
      messages: [] as string[]
    };
    
    // 验证决策类型
    if (decision.type !== 'EXECUTE_MCP') {
      validationResult.isValid = false;
      validationResult.messages.push(`❌ 决策类型错误：期望 EXECUTE_MCP，实际 ${decision.type}`);
    } else {
      validationResult.messages.push('✅ 决策类型正确：EXECUTE_MCP');
    }
    
    // 验证是否有 mcpParams
    if (!decision.data?.mcpParams) {
      validationResult.isValid = false;
      validationResult.messages.push('❌ 缺少 mcpParams');
    } else {
      validationResult.messages.push('✅ 包含 mcpParams');
      
      // 验证 solutionNum
      const selectedCapability = capabilities.find(c => c.id === decision.data.mcpParams.solutionNum);
      if (!selectedCapability) {
        validationResult.isValid = false;
        validationResult.messages.push(`❌ 找不到选定的 capability: ${decision.data.mcpParams.solutionNum}`);
      } else {
        validationResult.messages.push(`✅ 选定的 capability 有效: ${selectedCapability.functionDesc}`);
        
        // 验证 toolName 和 actionName
        if (selectedCapability.toolName !== decision.data.mcpParams.toolName) {
          validationResult.messages.push(`⚠️ toolName 不匹配: 期望 ${selectedCapability.toolName}, 实际 ${decision.data.mcpParams.toolName}`);
        }
        if (selectedCapability.actionName !== decision.data.mcpParams.actionName) {
          validationResult.messages.push(`⚠️ actionName 不匹配: 期望 ${selectedCapability.actionName}, 实际 ${decision.data.mcpParams.actionName}`);
        }
      }
      
      // 验证是否包含文章内容
      const params = decision.data.mcpParams.params || {};
      const hasContent = params.content || params.articleContent || params.text || params.priorStepOutput;
      if (!hasContent) {
        validationResult.isValid = false;
        validationResult.messages.push('❌ MCP 参数中缺少文章内容');
      } else {
        validationResult.messages.push('✅ MCP 参数包含文章内容');
      }
    }

    // ========== 步骤6：实际执行 MCP（如果决策是 EXECUTE_MCP） ==========
    let mcpExecutionResult = null;
    if (decision.type === 'EXECUTE_MCP' && decision.data?.mcpParams) {
      console.log('[Test API] ========== 步骤6：实际执行 MCP ==========');
      
      const mcpParams = decision.data.mcpParams;
      console.log('[Test API] MCP 执行参数:', {
        toolName: mcpParams.toolName,
        actionName: mcpParams.actionName,
        params: mcpParams.params
      });
      
      try {
        const mcpResult = await genericMCPCall(
          mcpParams.toolName,
          mcpParams.actionName,
          mcpParams.params
        );
        
        console.log('[Test API] MCP 执行成功:', mcpResult);
        mcpExecutionResult = {
          success: true,
          result: mcpResult
        };
      } catch (error) {
        console.error('[Test API] MCP 执行失败:', error);
        mcpExecutionResult = {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }

    return NextResponse.json({
      mode: 'full',
      success: true,
      summary: {
        capabilitiesCount: capabilities.length,
        articleLength: testArticleContent.length,
        decisionType: decision.type,
        isValid: validationResult.isValid,
        mcpExecuted: mcpExecutionResult !== null,
        mcpSuccess: mcpExecutionResult?.success
      },
      validation: validationResult,
      decision: decision,
      mcpExecution: mcpExecutionResult,
      rawLLMResponse: llmResponse,
      testData: {
        capabilities: capabilities.map(c => ({
          id: c.id,
          functionDesc: c.functionDesc,
          toolName: c.toolName,
          actionName: c.actionName
        })),
        articlePreview: testArticleContent.substring(0, 500)
      }
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
