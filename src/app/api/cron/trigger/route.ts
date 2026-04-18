/**
 * POST /api/cron/trigger
 * 手动触发定时任务
 *
 * GET /api/cron/trigger
 * 获取定时任务列表和状态
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  triggerCronJob,
  getCronJobsStatus,
  CRON_JOBS,
} from '@/lib/cron/scheduler';

/**
 * POST /api/cron/trigger
 * 手动触发定时任务
 *
 * 请求体:
 * {
 *   "job": "schedule-daily-tasks" | "dispatch-agent-subtasks" | "monitor-subtasks-timeout" | "escalate-unresolved-issues"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const job = body.job as keyof typeof CRON_JOBS;

    if (!job) {
      return NextResponse.json(
        {
          success: false,
          error: '请指定要触发的定时任务',
          availableJobs: Object.keys(CRON_JOBS),
        },
        { status: 400 }
      );
    }

    if (!CRON_JOBS[job]) {
      return NextResponse.json(
        {
          success: false,
          error: '无效的定时任务名称',
          availableJobs: Object.keys(CRON_JOBS),
        },
        { status: 400 }
      );
    }

    console.log(`🔔 手动触发定时任务: ${CRON_JOBS[job].name}`);

    // 触发定时任务
    const result = await triggerCronJob(job);

    return NextResponse.json({
      success: true,
      message: `定时任务 [${CRON_JOBS[job].name}] 触发成功`,
      job: CRON_JOBS[job].name,
      result,
    });
  } catch (error) {
    console.error('❌ 触发定时任务失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/trigger
 * 获取定时任务列表和状态
 */
export async function GET() {
  const status = getCronJobsStatus();

  return NextResponse.json({
    success: true,
    message: '定时任务列表',
    jobs: status,
    summary: {
      total: Object.keys(CRON_JOBS).length,
      active: Object.values(status).filter((job: any) => job.active).length,
      inactive: Object.values(status).filter((job: any) => !job.active).length,
    },
  });
}
