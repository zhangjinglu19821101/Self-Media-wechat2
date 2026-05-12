import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const commandResultId = searchParams.get('commandResultId');

    if (!commandResultId) {
      return NextResponse.json({ 
        success: false, 
        error: '缺少 commandResultId 参数' 
      }, { status: 400 });
    }

    // 查询历史记录
    const historyRecords = await db
      .select()
      .from(agentSubTasksStepHistory)
      .where(eq(agentSubTasksStepHistory.commandResultId, commandResultId))
      .orderBy(agentSubTasksStepHistory.stepNo, agentSubTasksStepHistory.interactNum);

    return NextResponse.json({
      success: true,
      count: historyRecords.length,
      data: historyRecords
    });
  } catch (error) {
    console.error('查询历史记录失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: '查询失败: ' + (error as Error).message 
    }, { status: 500 });
  }
}
