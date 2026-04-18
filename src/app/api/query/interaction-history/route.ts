/**
 * 交互历史查询 API
 *
 * GET /api/query/interaction-history
 *
 * 功能：查询 agent_sub_tasks_step_history 表数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const commandResultId = searchParams.get('commandResultId');
    const stepNo = searchParams.get('stepNo');

    console.log('[Interaction History Query] 查询参数:', {
      commandResultId,
      stepNo
    });

    if (!commandResultId) {
      return NextResponse.json(
        { success: false, error: '缺少 commandResultId 参数' },
        { status: 400 }
      );
    }

    // 构建查询条件
    const whereConditions = [
      eq(agentSubTasksStepHistory.commandResultId, commandResultId)
    ];

    if (stepNo) {
      whereConditions.push(eq(agentSubTasksStepHistory.stepNo, parseInt(stepNo)));
    }

    // 查询数据
    const records = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(and(...whereConditions))
      .orderBy(agentSubTasksStepHistory.interactTime);

    console.log('[Interaction History Query] 查询到记录数:', records.length);

    return NextResponse.json({
      success: true,
      data: {
        records: records.map(record => ({
          id: record.id,
          stepNo: record.stepNo,
          interactNum: record.interactNum,
          interactType: record.interactType,
          interactUser: record.interactUser,
          interactTime: record.interactTime?.toISOString(),
          interactContent: record.interactContent
        }))
      }
    });

  } catch (error) {
    console.error('[Interaction History Query] 查询失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    );
  }
}
