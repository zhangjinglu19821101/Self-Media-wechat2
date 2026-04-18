import { NextRequest, NextResponse } from 'next/server';
import { AgentResponseParser } from '@/lib/services/agent-response-parser';
import { SubtaskExecutionEngine } from '@/lib/services/subtask-execution-engine';

const TEST_LLM_RESPONSE = `{
  "type": "EXECUTE_MCP",
  "reasonCode": "MCP_CONTINUE",
  "reasoning": "执行Agent明确表示需要MCP技术支持进行合规检查，才能继续完成文章内容优化任务",
  "decisionBasis": "1. 参考信息：执行Agent反馈isCompleted=false，needsMcpSupport=true，mcpSupportReason为需要先进行内容合规检查，才能继续优化；2. 应用规则：执行Agent明确表示需要MCP支持时，统一返回EXECUTE_MCP；3. 为什么选择EXECUTE_MCP：合规检查属于需要MCP技术支持的任务，执行Agent不具备自行完成该检查的能力，必须由Agent T提供技术支持；4. 判断过程：检查执行Agent的反馈字段 → 发现needsMcpSupport=true → 应用需要MCP支持的规则 → 决策EXECUTE_MCP，建议执行者为agent T",
  "notCompletedReason": "mcp_result_pending",
  "context": {
    "executionSummary": "执行Agent需要先通过MCP进行内容合规检查，才能继续优化文章内容",
    "riskLevel": "low",
    "suggestedAction": "调用MCP进行内容合规检查",
    "suggestedExecutor": "agent T"
  },
  "data": {
    "mcpParams": {
      "solutionNum": 1,
      "toolName": "",
      "actionName": "",
      "params": {
        "accountId": "insurance-test-account"
      }
    }
  }
}`;

export async function GET() {
  try {
    console.log('[TestParser] 开始测试 AgentResponseParser');
    
    // 步骤 1: 测试 parseAgentBResponse
    console.log('[TestParser] 步骤 1: 测试 parseAgentBResponse');
    const parserResult = AgentResponseParser.parseAgentBResponse(TEST_LLM_RESPONSE);
    console.log('[TestParser] parseAgentBResponse 完整结果:', JSON.stringify(parserResult, null, 2));
    console.log('[TestParser] parseAgentBResult.data:', JSON.stringify(parserResult.data, null, 2));
    console.log('[TestParser] parseAgentBResult.decision:', JSON.stringify(parserResult.decision, null, 2));
    
    // 步骤 2: 测试 recordAgentInteraction
    console.log('[TestParser] 步骤 2: 测试 recordAgentInteraction');
    const engine = new SubtaskExecutionEngine();
    const mockUserPrompt = '这是一个测试用户提示词';
    const interactNum = await engine.recordAgentInteraction(
      'test-cmd-id-123', // commandResultId
      1, // stepNo
      'agent B', // agentId
      { type: 'agent_b_review', taskTitle: '测试任务' }, // requestContent
      'EXECUTE_MCP', // responseStatus
      parserResult.data, // responseContent - 应该传 parserResult.data！
      'test-subtask-id', // subTaskId
      1 // iteration
    );
    console.log('[TestParser] recordAgentInteraction 结果 interactNum:', interactNum);
    
    // 步骤 3: 查询保存的记录
    console.log('[TestParser] 步骤 3: 查询保存的记录');
    const { db } = await import('@/lib/db');
    const { agentSubTasksStepHistory } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');
    
    const savedRecords = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(eq(agentSubTasksStepHistory.commandResultId, 'test-cmd-id-123'));
    
    console.log('[TestParser] 保存的记录数:', savedRecords.length);
    if (savedRecords.length > 0) {
      console.log('[TestParser] 最新记录的 interactContent:', savedRecords[savedRecords.length - 1].interactContent);
    }
    
    return NextResponse.json({
      success: true,
      parserResult,
      interactNum,
      savedRecordsCount: savedRecords.length,
      savedRecords: savedRecords.map(r => ({
        interactNum: r.interactNum,
        interactType: r.interactType,
        interactContent: r.interactContent
      }))
    });
  } catch (error) {
    console.error('[TestParser] 错误:', error);
    return NextResponse.json(
      { error: '测试失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}