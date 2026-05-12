/**
 * 查看 interact_content 字段的实际数据结构
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasksStepHistory } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const commandResultId = searchParams.get('commandResultId');

    let records;

    if (commandResultId) {
      records = await db
        .select()
        .from(agentSubTasksStepHistory)
        .where(eq(agentSubTasksStepHistory.commandResultId, commandResultId as any))
        .orderBy(agentSubTasksStepHistory.stepNo, agentSubTasksStepHistory.interactNum);
    } else {
      records = await db
        .select()
        .from(agentSubTasksStepHistory)
        .orderBy(desc(agentSubTasksStepHistory.interactTime))
        .limit(10);
    }

    // 解析 interact_content 并展示结构
    const result = records.map(record => {
      const content = record.interactContent as any;
      const contentKeys = Object.keys(content || {});

      let parsedContent = null;
      if (content) {
        parsedContent = {
          hasQuestion: !!content.question,
          hasResponse: !!content.response,
          hasExtInfo: !!content.ext_info,
          hasExecutionResult: !!content.execution_result,
          hasInteractType: !!content.interact_type,
          hasResponder: !!content.responder,
          hasConsultant: !!content.consultant,
        };

        if (content.response) {
          parsedContent.responseKeys = Object.keys(content.response);
          parsedContent.hasDecision = !!content.response.decision;
          parsedContent.hasMcpAttempts = !!content.response.mcp_attempts;
          parsedContent.hasExecutionSummary = !!content.response.execution_summary;
          parsedContent.hasUserInteractions = !!content.response.user_interactions;

          if (content.response.decision) {
            parsedContent.decisionType = content.response.decision.type;
            parsedContent.decisionKeys = Object.keys(content.response.decision);
          }

          if (content.response.mcp_attempts && Array.isArray(content.response.mcp_attempts)) {
            parsedContent.mcpAttemptsCount = content.response.mcp_attempts.length;
            if (content.response.mcp_attempts.length > 0) {
              const firstAttempt = content.response.mcp_attempts[0];
              parsedContent.firstAttemptKeys = Object.keys(firstAttempt);
              parsedContent.firstAttemptHasDecision = !!firstAttempt.decision;
              parsedContent.firstAttemptHasResult = !!firstAttempt.result;
              parsedContent.firstAttemptHasParams = !!firstAttempt.params;
            }
          }
        }
      }

      return {
        commandResultId: record.commandResultId,
        stepNo: record.stepNo,
        interactNum: record.interactNum,
        interactType: record.interactType,
        interactUser: record.interactUser,
        interactTime: record.interactTime,
        contentKeys,
        parsedContent
      };
    });

    return NextResponse.json({
      success: true,
      totalRecords: records.length,
      records: result
    });

  } catch (error) {
    console.error('❌ 查询失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
