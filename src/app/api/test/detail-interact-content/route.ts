/**
 * 获取 interact_content 的完整详细数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasksStepHistory } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const commandResultId = searchParams.get('commandResultId') || '7b005762-6480-4e39-8678-73d6b1233d2d';
    const type = searchParams.get('type') || 'sample';

    const records = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(eq(agentSubTasksStepHistory.commandResultId, commandResultId as any))
      .orderBy(agentSubTasksStepHistory.stepNo, agentSubTasksStepHistory.interactNum);

    if (type === 'sample') {
      // 返回几个关键样本的完整数据
      const samples = [];

      // 找一个 NEED_USER 的 response
      const needUserRecord = records.find(r => {
        const content = r.interactContent as any;
        return r.interactType === 'response' && content?.response?.decision?.type === 'NEED_USER';
      });

      // 找一个 COMPLETE 的 response
      const completeRecord = records.find(r => {
        const content = r.interactContent as any;
        return r.interactType === 'response' && content?.response?.decision?.type === 'COMPLETE';
      });

      // 找一个 FAILED 的 response
      const failedRecord = records.find(r => {
        const content = r.interactContent as any;
        return r.interactType === 'response' && content?.response?.decision?.type === 'FAILED';
      });

      // 找一个有 mcp_attempts 的
      const mcpRecord = records.find(r => {
        const content = r.interactContent as any;
        return r.interactType === 'response' && content?.response?.mcp_attempts?.length > 0;
      });

      if (needUserRecord) samples.push({ type: 'NEED_USER', data: needUserRecord });
      if (completeRecord) samples.push({ type: 'COMPLETE', data: completeRecord });
      if (failedRecord) samples.push({ type: 'FAILED', data: failedRecord });
      if (mcpRecord) samples.push({ type: 'WITH_MCP_ATTEMPTS', data: mcpRecord });

      return NextResponse.json({
        success: true,
        totalRecords: records.length,
        samples: samples.map(s => ({
          type: s.type,
          stepNo: s.data.stepNo,
          interactNum: s.data.interactNum,
          interactContent: s.data.interactContent
        }))
      });

    } else {
      // 返回所有记录的结构概览
      return NextResponse.json({
        success: true,
        totalRecords: records.length,
        records: records.map(r => ({
          stepNo: r.stepNo,
          interactNum: r.interactNum,
          interactType: r.interactType,
          interactUser: r.interactUser,
          interactContent: r.interactContent
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
