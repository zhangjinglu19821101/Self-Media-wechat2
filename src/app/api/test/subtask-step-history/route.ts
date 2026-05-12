import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasksStepHistory, agentSubTasks } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const commandResultId = searchParams.get('commandResultId');

    let query = db
      .select({
        history: agentSubTasksStepHistory,
        subTask: agentSubTasks,
      })
      .from(agentSubTasksStepHistory)
      .leftJoin(agentSubTasks, eq(agentSubTasksStepHistory.commandResultId, agentSubTasks.commandResultId));

    if (commandResultId) {
      query = query.where(eq(agentSubTasksStepHistory.commandResultId, commandResultId));
    }

    const results = await query
      .orderBy(desc(agentSubTasksStepHistory.interactTime))
      .limit(limit);

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('查询子任务步骤历史失败:', error);
    return NextResponse.json(
      { success: false, error: '查询失败' },
      { status: 500 }
    );
  }
}
