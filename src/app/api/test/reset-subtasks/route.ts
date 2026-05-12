import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const results: any[] = [];

    // 重置 agent B 的测试子任务
    await db
      .update(agentSubTasks)
      .set({
        status: 'in_progress',
        startedAt: new Date(),
        completedAt: null,
        executionResult: null,
        updatedAt: new Date(),
      })
      .where(eq(agentSubTasks.agentId, 'B'));

    // 重置 insurance-c 的测试子任务
    await db
      .update(agentSubTasks)
      .set({
        status: 'in_progress',
        startedAt: new Date(),
        completedAt: null,
        executionResult: null,
        updatedAt: new Date(),
      })
      .where(eq(agentSubTasks.agentId, 'insurance-c'));

    return NextResponse.json({
      success: true,
      message: '测试子任务已重置',
      note: '请再次执行子任务以验证 executionResult 是否正确保存',
    });
  } catch (error) {
    console.error('重置测试子任务失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
