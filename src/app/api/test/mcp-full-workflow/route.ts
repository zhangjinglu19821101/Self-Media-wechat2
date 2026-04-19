/**
 * Mock 测试：MCP 完整工作流程
 * 
 * 注意：此功能已迁移到新的任务系统
 */

import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: '此功能已迁移到新的任务系统',
      message: 'MCP 工作流程现在由 SubtaskExecutionEngine 自动处理',
    },
    { status: 410 }
  );
}
