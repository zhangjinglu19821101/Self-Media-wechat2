import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const testId = '05371365-2ff7-421c-b7a4-30e0800218b6';

    console.log('重置子任务状态为 in_progress');
    await db
      .update(agentSubTasks)
      .set({
        status: 'in_progress',
        startedAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
        statusProof: null,
        executionResult: null,
      })
      .where(eq(agentSubTasks.id, testId));

    const subTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.id, testId));

    return NextResponse.json({
      success: true,
      message: '子任务状态已重置为 in_progress',
      subTasks,
    });
  } catch (error) {
    console.error('重置失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
