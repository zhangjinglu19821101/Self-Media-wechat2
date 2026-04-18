
/**
 * 停止 agent_sub_tasks 相关的定时任务
 *
 * POST /api/cron/stop-subtasks
 */

import { NextResponse } from 'next/server';
import {
  stopCronJob,
  getCronJobsStatus,
} from '@/lib/cron/scheduler';

// agent_sub_tasks 相关的定时任务
const SUBTASKS_CRON_JOBS = [
  'MONITOR_SUBTASKS_TIMEOUT',
  'ESCALATE_UNRESOLVED_ISSUES',
] as const;

export async function POST() {
  console.log('[Stop Subtasks Cron] 开始停止 agent_sub_tasks 相关定时任务...');

  try {
    const results: Record<string, boolean> = {};

    // 停止每个相关的定时任务
    for (const jobKey of SUBTASKS_CRON_JOBS) {
      const stopped = stopCronJob(jobKey);
      results[jobKey] = stopped;
    }

    // 获取当前状态
    const status = getCronJobsStatus();

    console.log('[Stop Subtasks Cron] 停止完成');
    console.log('[Stop Subtasks Cron] 结果:', results);

    return NextResponse.json({
      success: true,
      message: 'agent_sub_tasks 相关定时任务已停止',
      data: {
        stopped: results,
        currentStatus: status,
      },
    });
  } catch (error) {
    console.error('[Stop Subtasks Cron] 停止失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET - 获取 agent_sub_tasks 相关定时任务状态
 */
export async function GET() {
  try {
    const status = getCronJobsStatus();

    // 只返回相关的定时任务状态
    const subtasksStatus: Record<string, any> = {};
    for (const jobKey of SUBTASKS_CRON_JOBS) {
      if (status[jobKey]) {
        subtasksStatus[jobKey] = status[jobKey];
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        subtasksCronJobs: SUBTASKS_CRON_JOBS,
        status: subtasksStatus,
      },
    });
  } catch (error) {
    console.error('[Stop Subtasks Cron] 获取状态失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

