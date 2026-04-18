import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const commandResultId = searchParams.get('commandResultId');
    const orderIndex = searchParams.get('orderIndex');

    if (!commandResultId || !orderIndex) {
      return NextResponse.json({ error: '缺少 commandResultId 或 orderIndex 参数' }, { status: 400 });
    }

    const history = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(
        and(
          eq(agentSubTasksStepHistory.commandResultId, commandResultId),
          eq(agentSubTasksStepHistory.stepNo, parseInt(orderIndex))
        )
      )
      .orderBy(agentSubTasksStepHistory.interactNum);

    return NextResponse.json({
      success: true,
      count: history.length,
      history
    });

  } catch (error) {
    console.error('[GetStepHistory] 错误:', error);
    return NextResponse.json(
      { error: '查询失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
