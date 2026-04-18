import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    console.log('🔍 [检查任务详情] 开始查询...');

    // 1. 查询最新的 agent_sub_tasks 记录
    const latestTasks = await db
      .select()
      .from(agentSubTasks)
      .orderBy(desc(agentSubTasks.updatedAt))
      .limit(5);

    // 2. 查询对应的 step_history 记录（简化版本：只查第一条任务的历史）
    const stepHistoryRecords = latestTasks.length > 0
      ? await db
          .select()
          .from(agentSubTasksStepHistory)
          .where(eq(agentSubTasksStepHistory.commandResultId, latestTasks[0].commandResultId as any))
          .orderBy(agentSubTasksStepHistory.id)
      : [];

    console.log('🔍 [检查任务详情] 查询完成');
    console.log('   - 最新任务数:', latestTasks.length);
    console.log('   - 历史记录数:', stepHistoryRecords.length);

    return NextResponse.json({
      success: true,
      latestTasks,
      stepHistoryRecords
    });
  } catch (error: any) {
    console.error('❌ [检查任务详情] 失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
