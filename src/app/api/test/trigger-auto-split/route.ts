import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/test/trigger-auto-split
 * 测试手动触发自动拆解定时任务
 */
export async function POST() {
  try {
    console.log('🧪 手动触发自动拆解定时任务...');

    const response = await fetch('http://localhost:5000/api/cron/auto-split-agent-tasks', {
      method: 'POST',
    });

    const result = await response.json();

    console.log('✅ 定时任务执行结果:', result);

    return NextResponse.json({
      success: true,
      message: '定时任务已触发',
      result,
    });
  } catch (error) {
    console.error('❌ 触发定时任务失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

/**
 * GET /api/test/trigger-auto-split
 * 查询待拆解任务数量
 */
export async function GET() {
  try {
    const response = await fetch('http://localhost:5000/api/cron/auto-split-agent-tasks');
    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: '待拆解任务状态',
      result,
    });
  } catch (error) {
    console.error('❌ 查询失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
