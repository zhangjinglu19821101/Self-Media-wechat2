/**
 * 确认拆解结果并保存到 daily_task 表（Agent B 和 insurance-c 使用）
 * POST /api/daily-tasks/confirm-split
 */

import { NextRequest, NextResponse } from 'next/server';
import { saveSplitResultToDailyTasks } from '@/lib/services/save-split-result-v2';
import { requireAuth } from '@/lib/auth/context';

/**
 * POST /api/daily-tasks/confirm-split
 * 确认拆解结果并保存到 daily_task 表（Agent B 和 insurance-c 使用）
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { taskId, splitResult } = body;

    if (!taskId || !splitResult) {
      return NextResponse.json(
        { success: false, error: '缺少 taskId 或 splitResult 参数' },
        { status: 400 }
      );
    }

    const result = await saveSplitResultToDailyTasks(taskId, splitResult);

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error('❌ 保存拆解结果失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
