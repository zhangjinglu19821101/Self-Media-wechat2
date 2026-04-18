import { NextRequest, NextResponse } from 'next/server';
import { AgentResponseParser } from '@/lib/services/agent-response-parser';

export const maxDuration = 60;

// 手动输入刚才看到的 Agent B 原始返回内容
const AGENT_B_RAW_RESPONSE = `{
  "type": "EXECUTE_MCP",
  "reasonCode": "MCP_CONTINUE",
  "reasoning": "执行Agent表示该合规校验任务不属于其职责范围，且明确需要MCP支持，因此需要调用技术处理能力完成公众号文章合规校验",
  "decisionBasis": "1. 参考信息：执行Agent反馈isNeedMcp=true，isTaskDown=false，执行Agent思考内容显示该合规校验任务不属于其职责范围；2. 应用规则：执行Agent明确表示需要MCP支持时，决策为EXECUTE_MCP；职责范围路由规则中，执行Agent无法处理的合规类任务需路由到Agent T；3. 为什么选择这个决策而不是其他：任务未完成（isTaskDown=false），且执行Agent无法处理该合规任务，需要技术能力支持，因此不选择COMPLETE；执行Agent已明确表示无法处理，无需重新执行，因此不选择REEXECUTE_EXECUTOR；当前无需用户介入即可通过技术能力处理，因此不选择NEED_USER；4. 具体的判断过程：检查执行Agent核心判断字段，发现isNeedMcp=true，isTaskDown=false；查看执行Agent思考内容，确认该任务不属于其职责范围；应用需要MCP支持的规则和职责路由规则，决策为EXECUTE_MCP，建议执行者为agent T",
  "notCompletedReason": "mcp_result_pending",
  "context": {
    "executionSummary": "执行Agent无法处理公众号文章合规校验任务，需要调用MCP技术能力完成",
    "riskLevel": "low",
    "suggestedAction": "调用MCP进行公众号文章合规审核",
    "suggestedExecutor": "agent T"
  },
  "data": {
    "mcpParams": {
      "solutionNum": 1,
      "toolName": "",
      "actionName": "",
      "params": {
        "accountId": "insurance-account"
      }
    }
  }
}`;

export async function POST(request: NextRequest) {
  console.log('[Test] ========== 测试 Agent B 解析 ==========');
  
  try {
    console.log('[Test] 步骤1: 调用 AgentResponseParser.parseAgentBResponse');
    const parseResult = AgentResponseParser.parseAgentBResponse(AGENT_B_RAW_RESPONSE);
    
    console.log('[Test] 步骤2: 返回结果');
    
    return NextResponse.json({
      success: true,
      parseResult: parseResult,
      agent_b_raw_response: AGENT_B_RAW_RESPONSE
    });
  } catch (error) {
    console.error('[Test] 测试失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
