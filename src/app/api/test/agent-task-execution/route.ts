/**
 * POST /api/test/agent-task-execution
 * 
 * Agent 任务执行测试 API
 * 
 * 注意：此功能已迁移到新的任务系统
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: '此功能已迁移到新的任务系统',
      message: '任务执行现在由 SubtaskExecutionEngine 自动处理，请使用 /api/tasks 接口',
    },
    { status: 410 }
  );
}
