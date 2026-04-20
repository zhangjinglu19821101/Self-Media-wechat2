/**
 * 信息速记提醒定时任务 API
 * 可通过外部 cron 服务调用，或由内部调度器自动触发
 */

import { NextRequest, NextResponse } from 'next/server';
import { triggerSnippetReminders } from '@/lib/cron/snippet-reminders';

/**
 * GET /api/cron/snippet-reminders
 * 检查并触发到期的提醒
 * 
 * 调用方式：
 * 1. 内部调度器自动调用（每分钟）
 * 2. 外部 cron 服务调用：curl http://localhost:5000/api/cron/snippet-reminders
 */
export async function GET(request: NextRequest) {
  try {
    const result = await triggerSnippetReminders();

    return NextResponse.json({
      success: true,
      message: result.triggered > 0 
        ? `已触发 ${result.triggered} 个提醒`
        : '没有需要触发的提醒',
      triggered: result.triggered,
      reminders: result.reminders,
    });
  } catch (error: any) {
    console.error('[snippet-reminders API] 错误:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
