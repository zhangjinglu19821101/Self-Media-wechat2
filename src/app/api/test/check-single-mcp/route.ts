/**
 * 查看单条 mcp_attempt 记录的详细数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const commandResultId = searchParams.get('commandResultId') || 'acc073b1-f86f-45d8-80ca-1779c7433102';

  try {
    const records = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(eq(agentSubTasksStepHistory.commandResultId, commandResultId as any))
      .orderBy(agentSubTasksStepHistory.stepNo, agentSubTasksStepHistory.interactNum);

    // 找有 mcp_attempts 且有错误的记录
    let targetRecord = null;
    for (const record of records) {
      const content = record.interactContent as any;
      if (record.interactType === 'response' && content?.response?.mcp_attempts) {
        const attempts = content.response.mcp_attempts;
        for (const attempt of attempts) {
          if (attempt.result?.data?.error) {
            targetRecord = record;
            break;
          }
        }
        if (targetRecord) break;
      }
    }

    if (targetRecord) {
      const content = targetRecord.interactContent as any;
      const mcpAttempts = content.response.mcp_attempts;

      return NextResponse.json({
        success: true,
        message: '找到有错误的 MCP 调用记录',
        stepNo: targetRecord.stepNo,
        interactNum: targetRecord.interactNum,
        totalAttempts: mcpAttempts.length,
        attempts: mcpAttempts.map((attempt: any, idx: number) => ({
          attemptNo: idx + 1,
          toolName: attempt.decision?.toolName,
          actionName: attempt.decision?.actionName,
          businessSuccess: attempt.result?.data?.success === true,
          hasError: !!attempt.result?.data?.error,
          error: attempt.result?.data?.error || null,
          // 完整原始数据
          _raw: attempt
        }))
      });
    } else {
      return NextResponse.json({
        success: false,
        message: '没有找到有错误的 MCP 调用记录',
        sample: records.slice(0, 3).map(r => ({
          stepNo: r.stepNo,
          interactNum: r.interactNum,
          interactType: r.interactType,
        }))
      });
    }

  } catch (error) {
    console.error('❌ 查询失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
