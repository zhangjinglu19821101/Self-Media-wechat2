/**
 * 手动触发执行 in_progress 子任务
 * POST /api/cron/execute-in-progress-subtasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { manuallyExecuteInProgressSubtasks } from '@/lib/cron';

/**
 * POST /api/cron/execute-in-progress-subtasks
 * 手动触发执行 in_progress 状态的子任务
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔔 手动触发执行 in_progress 子任务...');

    await manuallyExecuteInProgressSubtasks();

    return NextResponse.json({
      success: true,
      message: 'in_progress 子任务执行已完成',
    });
  } catch (error) {
    console.error('❌ 执行 in_progress 子任务失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '执行失败',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/execute-in-progress-subtasks
 * 获取定时任务信息
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    name: 'execute-in-progress-subtasks',
    description: '执行 in_progress 状态的子任务',
    cronExpression: '*/2 * * * *', // 每 2 分钟运行一次
    usage: {
      method: 'POST',
      endpoint: '/api/cron/execute-in-progress-subtasks',
    },
  });
}
