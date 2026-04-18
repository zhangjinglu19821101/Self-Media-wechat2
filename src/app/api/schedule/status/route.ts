import { NextRequest, NextResponse } from 'next/server';
import { globalScheduler } from '@/lib/global-schedule/scheduler';
import { TaskManager } from '@/lib/global-schedule/task-manager';

/**
 * GET /api/schedule/status
 * 获取全局调度服务状态
 */
export async function GET(request: NextRequest) {
  console.log('📥 === /api/schedule/status 收到状态查询请求 ===');

  try {
    // 获取调度器状态
    const schedulerStatus = globalScheduler.getStatus();

    // 获取所有任务
    const allTasks = await TaskManager.getAllTasks();

    // 获取到期任务
    const dueTasks = await TaskManager.getDueTasks();

    // 统计任务状态
    const taskStats = {
      total: allTasks.length,
      pending: allTasks.filter(t => t.status === 'pending').length,
      running: allTasks.filter(t => t.status === 'running').length,
      completed: allTasks.filter(t => t.status === 'completed').length,
      failed: allTasks.filter(t => t.status === 'failed').length,
      due: dueTasks.length
    };

    return NextResponse.json({
      success: true,
      data: {
        scheduler: schedulerStatus,
        tasks: taskStats,
        dueTasks: dueTasks.map(t => ({
          taskId: t.taskId,
          taskName: t.taskName,
          nextExecutionAt: t.nextExecutionAt
        }))
      }
    });
  } catch (error) {
    console.error('获取状态失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取状态失败'
      },
      { status: 500 }
    );
  }
}
