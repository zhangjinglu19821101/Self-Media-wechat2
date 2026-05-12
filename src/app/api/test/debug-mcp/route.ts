/**
 * 调试查看 mcp_attempts 的原始数据结构
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasksStepHistory } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const commandResultId = searchParams.get('commandResultId') || 'acc073b1-f86f-45d8-80ca-1779c7433102';

  try {
    const records = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(eq(agentSubTasksStepHistory.commandResultId, commandResultId as any))
      .orderBy(agentSubTasksStepHistory.stepNo, agentSubTasksStepHistory.interactNum);

    // 检查所有记录
    const allData = [];

    for (const record of records) {
      const content = record.interactContent as any;
      if (record.interactType === 'response' && content?.response) {
        allData.push({
          stepNo: record.stepNo,
          interactNum: record.interactNum,
          hasMcpAttempts: !!content.response.mcp_attempts,
          mcpAttemptsLength: content.response.mcp_attempts?.length || 0,
          hasDecision: !!content.response.decision,
          decisionType: content.response.decision?.type,
        });
      }
    }

    // 找到第一条有 mcp_attempts 的记录
    const responseWithMcp = records.find(r => {
      const content = r.interactContent as any;
      return r.interactType === 'response' && content?.response?.mcp_attempts && content.response.mcp_attempts.length > 0;
    });

    if (responseWithMcp) {
      const content = responseWithMcp.interactContent as any;
      const mcpAttempts = content.response.mcp_attempts;

      return NextResponse.json({
        success: true,
        message: '查看 mcp_attempts 原始数据结构',
        overview: allData,
        foundRecord: {
          stepNo: responseWithMcp.stepNo,
          interactNum: responseWithMcp.interactNum,
          totalAttempts: mcpAttempts.length,
        },
        sampleAttempt: mcpAttempts[0],
        allAttempts: mcpAttempts,
      });
    } else {
      return NextResponse.json({
        success: false,
        message: '没有找到包含 mcp_attempts 的记录',
        overview: allData,
        sampleRecords: records.slice(0, 3).map(r => ({
          stepNo: r.stepNo,
          interactType: r.interactType,
          contentKeys: Object.keys((r.interactContent as any) || {})
        }))
      });
    }

  } catch (error) {
    console.error('❌ 调试失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
