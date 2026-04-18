import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask, agentTasks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { TaskManager } from '@/lib/services/task-manager';

/**
 * GET /api/commands/review?agentId=agentA - 查看待审核任务（Agent A）
 *
 * 查询参数：
 * - agentId: Agent ID
 * - taskId (可选): 指定任务 ID
 *
 * 响应：
 * {
 *   success: true,
 *   data: {
 *     task: { ... },
 *     subTasks: [ ... ]
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId');
    const taskId = searchParams.get('taskId');

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: '缺少必填参数：agentId' },
        { status: 400 }
      );
    }

    if (taskId) {
      // 查询指定任务的拆解
      const task = await TaskManager.getTask(taskId);
      if (!task) {
        return NextResponse.json(
          { success: false, error: '任务不存在' },
          { status: 404 }
        );
      }

      if (task.fromAgentId !== agentId) {
        return NextResponse.json(
          { success: false, error: '无权查看此任务' },
          { status: 403 }
        );
      }

      // 查询子任务
      const subTasks = await db
        .select()
        .from(dailyTask)
        .where(eq(dailyTask.relatedTaskId, taskId))
        .orderBy(dailyTask.sortOrder);

      return NextResponse.json({
        success: true,
        data: {
          task,
          subTasks,
        },
      });
    } else {
      // 查询所有待审核任务
      const tasks = await TaskManager.getPendingReviewTasks(agentId);

      const result = await Promise.all(
        tasks.map(async (task) => {
          const subTasks = await db
            .select()
            .from(dailyTask)
            .where(eq(dailyTask.relatedTaskId, task.taskId))
            .orderBy(dailyTask.sortOrder);

          return {
            task,
            subTasks,
          };
        })
      );

      return NextResponse.json({
        success: true,
        data: result,
      });
    }
  } catch (error: any) {
    console.error('❌ 查询待审核任务失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '查询失败' },
      { status: 500 }
    );
  }
}
