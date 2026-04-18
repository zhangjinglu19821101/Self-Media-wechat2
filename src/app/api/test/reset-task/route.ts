/**
 * 重置任务状态（用于测试）
 * POST /api/test/reset-task
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, commandResultId } = body;

    if (!taskId && !commandResultId) {
      return NextResponse.json(
        { success: false, error: '缺少必需参数：taskId 或 commandResultId' },
        { status: 400 }
      );
    }

    console.log('🔄 [test-reset-task] 重置任务状态:', { taskId, commandResultId });

    let resetCount = 0;
    
    if (commandResultId) {
      // 根据 commandResultId 重置所有相关的子任务
      const result = await db
        .update(agentSubTasks)
        .set({
          status: 'pending',
          resultData: null,
          resultText: null,
          startedAt: null,
          completedAt: null,
          updatedAt: new Date()
        })
        .where(eq(agentSubTasks.commandResultId, commandResultId));
      
      resetCount = result.count || 0;
      console.log(`✅ [test-reset-task] 已重置 ${resetCount} 个子任务 (commandResultId: ${commandResultId})`);
    } else if (taskId) {
      // 根据 taskId 重置单个任务
      await db
        .update(agentSubTasks)
        .set({
          status: 'pending',
          resultData: null,
          resultText: null,
          startedAt: null,
          completedAt: null,
          updatedAt: new Date()
        })
        .where(eq(agentSubTasks.id, taskId));
      
      resetCount = 1;
      console.log('✅ [test-reset-task] 任务状态已重置');
    }

    return NextResponse.json({
      success: true,
      message: '任务状态已重置',
      data: { taskId, commandResultId, resetCount }
    });
  } catch (error) {
    console.error('❌ [test-reset-task] 重置失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '重置失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
