import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dailyTask, agentTasks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/commands/pending - 查询待执行任务
 *
 * 查询参数：
 * - executor: 执行主体（如：技术专家团队）
 * - executionDate (可选): 执行日期（YYYY-MM-DD）
 * - taskId (可选): 关联任务 ID
 *
 * 响应：
 * {
 *   success: true,
 *   data: [
 *     {
 *       commandId: "cmd-task-20260222-001-01",
 *       relatedTaskId: "task-001",
 *       commandContent: "...",
 *       executionDeadlineStart: "...",
 *       executionDeadlineEnd: "...",
 *       isConfirmed: true,
 *       dependencies: {},
 *       sortOrder: 1,
 *       ...
 *     }
 *   ]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const executor = searchParams.get('executor');
    const executionDate = searchParams.get('executionDate');
    const taskId = searchParams.get('taskId');

    if (!executor) {
      return NextResponse.json(
        { success: false, error: '缺少必填参数：executor' },
        { status: 400 }
      );
    }

    // 构建查询条件
    const conditions = [
      eq(dailyTask.executor, executor),
      eq(dailyTask.executionStatus, 'confirmed'), // 只返回已确认的任务
    ];

    if (executionDate) {
      conditions.push(eq(dailyTask.executionDate, executionDate));
    }

    if (taskId) {
      conditions.push(eq(dailyTask.relatedTaskId, taskId));
    }

    // 查询待执行任务
    const pendingTasks = await db
      .select()
      .from(dailyTask)
      .where(and(...conditions))
      .orderBy(dailyTask.executionDate, dailyTask.sortOrder);

    // 2. 检查任务依赖，标记可执行的任务
    const readyTasks = await Promise.all(
      pendingTasks.map(async (task) => {
        let isReady = true;
        let blockedBy: string[] = [];

        if (task.dependencies?.after && task.dependencies.after.length > 0) {
          // 检查前置任务是否都已完成
          const dependencies = task.dependencies.after;
          const dependencyStatuses = await Promise.all(
            dependencies.map(async (depCommandId) => {
              const [depTask] = await db
                .select()
                .from(dailyTask)
                .where(eq(dailyTask.commandId, depCommandId));
              return depTask;
            })
          );

          for (const dep of dependencyStatuses) {
            if (!dep || dep.executionStatus !== 'completed') {
              isReady = false;
              blockedBy.push(dep?.commandId || 'unknown');
            }
          }
        }

        return {
          ...task,
          isReady,
          blockedBy,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: readyTasks,
    });
  } catch (error: any) {
    console.error('❌ 查询待执行任务失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '查询失败' },
      { status: 500 }
    );
  }
}
