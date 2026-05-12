/**
 * 展示真实的 Agent 与 Agent 交互数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasksStepHistory } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const commandResultId = searchParams.get('commandResultId') || '7b005762-6480-4e39-8678-73d6b1233d2d';

    const records = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(eq(agentSubTasksStepHistory.commandResultId, commandResultId as any))
      .orderBy(agentSubTasksStepHistory.stepNo, agentSubTasksStepHistory.interactNum);

    // 按 step_no 和 interact_num 分组
    const interactions = [];

    for (const record of records) {
      const content = record.interactContent as any;

      const interaction = {
        stepNo: record.stepNo,
        interactNum: record.interactNum,
        interactType: record.interactType,
        interactUser: record.interactUser,
        interactTime: record.interactTime,
        question: content?.question,
        response: null as any,
      };

      if (record.interactType === 'response' && content?.response) {
        interaction.response = {
          decisionType: content.response.decision?.type,
          decisionReasoning: content.response.decision?.reasoning?.substring?.(0, 200) || content.response.decision?.reasoning,
          hasMcpAttempts: !!content.response.mcp_attempts?.length,
          mcpAttemptsCount: content.response.mcp_attempts?.length || 0,
          hasExecutionSummary: !!content.response.execution_summary,
          hasUserInteractions: !!content.response.user_interactions?.length,
          promptMessage: content.response.prompt_message?.substring?.(0, 150) || content.response.prompt_message,
          mcpTools: content.response.mcp_attempts?.map?.(a => ({
            attemptNo: a.attemptNumber,
            toolName: a.decision?.toolName,
            actionName: a.decision?.actionName,
            success: a.result?.data?.success,
            error: a.result?.data?.error?.substring?.(0, 100) || a.result?.data?.error
          })) || []
        };
      }

      interactions.push(interaction);
    }

    // 生成对话式的交互描述
    const dialogues = [];
    for (let i = 0; i < interactions.length; i += 2) {
      const request = interactions[i];
      const response = interactions[i + 1];

      if (request && request.interactType === 'request') {
        const dialogue = {
          round: Math.floor(i / 2) + 1,
          stepNo: request.stepNo,
          interactNum: request.interactNum,
          from: request.interactUser,
          to: response?.interactUser || 'agent B',
          requestSummary: request.question?.response || request.question?.substring?.(0, 100) || '用户请求',
          responseDecision: response?.response?.decisionType,
          responseSummary: response?.response?.decisionReasoning?.substring?.(0, 150),
          mcpCalls: response?.response?.mcpTools || []
        };
        dialogues.push(dialogue);
      }
    }

    return NextResponse.json({
      success: true,
      commandResultId,
      totalRecords: records.length,
      interactions,
      dialogues
    });

  } catch (error) {
    console.error('❌ 查询失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
