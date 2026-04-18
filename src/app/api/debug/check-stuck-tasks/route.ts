/**
 * 调试 API：检查卡住的 in_progress 任务
 *
 * GET /api/debug/check-stuck-tasks
 * POST /api/debug/check-stuck-tasks - 手动触发超时处理
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasks, agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq, and, or, lte, desc } from 'drizzle-orm';
import { getCurrentBeijingTime } from '@/lib/utils/date-time';

export async function GET(request: NextRequest) {
  console.log('[Debug] ========== 检查卡住的任务 ==========');

  try {
    const now = getCurrentBeijingTime();
    const TEN_MINUTES = 10 * 60 * 1000;
    const tenMinutesAgo = new Date(now.getTime() - TEN_MINUTES);

    console.log('[Debug] 当前时间:', now.toISOString());
    console.log('[Debug] 10分钟前:', tenMinutesAgo.toISOString());

    // 1. 查询所有 in_progress 状态的任务
    const inProgressTasks = await db
      .select()
      .from(agentSubTasks)
      .where(eq(agentSubTasks.status, 'in_progress'))
      .orderBy(desc(agentSubTasks.updatedAt));

    console.log('[Debug] 找到 in_progress 任务数:', inProgressTasks.length);

    // 2. 检查哪些任务超时了（startedAt 超过10分钟）
    const stuckTasks = inProgressTasks.filter(task => {
      if (!task.startedAt) return false;
      const elapsed = now.getTime() - task.startedAt.getTime();
      return elapsed > TEN_MINUTES;
    });

    console.log('[Debug] 超时任务数:', stuckTasks.length);

    // 3. 为每个超时任务查询历史记录
    const tasksWithHistory = await Promise.all(
      stuckTasks.map(async task => {
        const historyRecords = task.commandResultId ? await db
          .select()
          .from(agentSubTasksStepHistory)
          .where(
            and(
              eq(agentSubTasksStepHistory.commandResultId, task.commandResultId),
              eq(agentSubTasksStepHistory.stepNo, task.orderIndex)
            )
          )
          .orderBy(agentSubTasksStepHistory.interactTime)
          : [];

        const elapsed = task.startedAt 
          ? now.getTime() - task.startedAt.getTime()
          : 0;

        return {
          task,
          elapsed,
          historyRecords,
          historyCount: historyRecords.length,
        };
      })
    );

    console.log('[Debug] ========== 检查完成 ==========');

    return NextResponse.json({
      success: true,
      data: {
        totalInProgress: inProgressTasks.length,
        stuckTasks: stuckTasks.length,
        tasks: tasksWithHistory,
        checkedAt: now.toISOString(),
      },
    });

  } catch (error) {
    console.error('[Debug] 检查失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '检查失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log('[Debug] ========== 手动触发超时处理 ==========');

  try {
    const body = await request.json();
    const { taskId, forceAll = false } = body;

    const now = getCurrentBeijingTime();
    const TEN_MINUTES = 10 * 60 * 1000;

    console.log('[Debug] 参数:', { taskId, forceAll });

    // 1. 查询要处理的任务
    let tasksToProcess;

    if (taskId) {
      // 处理指定任务
      const task = await db.query.agentSubTasks.findFirst({
        where: eq(agentSubTasks.id, taskId),
      });

      if (!task) {
        return NextResponse.json(
          { success: false, error: '未找到任务' },
          { status: 404 }
        );
      }

      tasksToProcess = [task];
    } else if (forceAll) {
      // 处理所有 in_progress 任务
      tasksToProcess = await db
        .select()
        .from(agentSubTasks)
        .where(eq(agentSubTasks.status, 'in_progress'));
    } else {
      // 只处理超时的任务
      const tenMinutesAgo = new Date(now.getTime() - TEN_MINUTES);
      tasksToProcess = await db
        .select()
        .from(agentSubTasks)
        .where(
          and(
            eq(agentSubTasks.status, 'in_progress'),
            lte(agentSubTasks.startedAt, tenMinutesAgo)
          )
        );
    }

    console.log('[Debug] 要处理的任务数:', tasksToProcess.length);

    if (tasksToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有需要处理的任务',
        processedCount: 0,
      });
    }

    // 2. 导入并调用子任务执行引擎的超时处理
    console.log('[Debug] 导入子任务执行引擎...');
    const { SubtaskExecutionEngine } = await import('@/lib/services/subtask-execution-engine');
    const engine = new SubtaskExecutionEngine();

    // 3. 直接调用超时处理方法（通过反射）
    console.log('[Debug] 开始处理超时任务...');
    
    const processedTasks = [];
    for (const task of tasksToProcess) {
      console.log('[Debug] 处理任务:', task.id, task.taskTitle);
      
      try {
        // 调用私有方法（在开发环境可以这样做）
        // @ts-ignore - 访问私有方法
        await engine.executeTimeoutWorkflow(task);
        
        processedTasks.push({
          taskId: task.id,
          title: task.taskTitle,
          status: 'processed',
        });
        
        console.log('[Debug] 任务处理完成:', task.id);
      } catch (error) {
        console.error('[Debug] 任务处理失败:', task.id, error);
        processedTasks.push({
          taskId: task.id,
          title: task.taskTitle,
          status: 'failed',
          error: error instanceof Error ? error.message : '处理失败',
        });
      }
    }

    console.log('[Debug] ========== 手动触发完成 ==========');

    return NextResponse.json({
      success: true,
      message: `处理完成，共处理 ${processedTasks.length} 个任务`,
      processedCount: processedTasks.length,
      tasks: processedTasks,
    });

  } catch (error) {
    console.error('[Debug] 手动触发失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '触发失败' },
      { status: 500 }
    );
  }
}
