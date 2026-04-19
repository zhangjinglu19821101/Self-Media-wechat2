import { NextResponse } from 'next/server';

/**
 * POST /api/test/check-and-fix-notification
 * 检查并修复通知
 * 
 * 注意：此功能已迁移到新的任务系统
 */
export async function POST(request: Request) {
  return NextResponse.json(
    {
      success: false,
      error: '此功能已迁移到新的任务系统',
      message: '通知系统已重构，请使用 /api/notifications 接口',
    },
    { status: 410 }
  );
}
