/**
 * 获取完整的 interact_content 字段内容
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const commandResultId = searchParams.get('commandResultId') || '7b005762-6480-4e39-8678-73d6b1233d2d';
    const limit = parseInt(searchParams.get('limit') || '3');

    const records = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(eq(agentSubTasksStepHistory.commandResultId, commandResultId as any))
      .orderBy(agentSubTasksStepHistory.stepNo, agentSubTasksStepHistory.interactNum)
      .limit(limit);

    return NextResponse.json({
      success: true,
      commandResultId,
      totalRecords: records.length,
      records: records.map((r, idx) => ({
        index: idx + 1,
        stepNo: r.stepNo,
        interactNum: r.interactNum,
        interactType: r.interactType,
        interactUser: r.interactUser,
        interactTime: r.interactTime,
        interactContent: r.interactContent
      }))
    });

  } catch (error) {
    console.error('❌ 查询失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
