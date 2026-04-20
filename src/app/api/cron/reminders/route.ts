/**
 * 提醒触发 Cron API
 * 
 * GET: 触发到期的提醒
 * 
 * 调用方式：
 * 1. 外部 cron 服务（如 cron-job.org）定期调用
 * 2. 内部定时脚本调用
 * 3. 手动触发
 */

import { NextRequest, NextResponse } from 'next/server';
import { triggerDueReminders } from '@/lib/services/reminder-service';

// Cron 密钥验证（可选）
const CRON_SECRET = process.env.CRON_SECRET || 'reminders-cron-2024';

export async function GET(request: NextRequest) {
  try {
    // 验证 cron 密钥（如果提供）
    const authHeader = request.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '');
    
    // 如果环境变量设置了密钥，则必须验证
    if (process.env.CRON_SECRET && providedSecret !== CRON_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 触发到期的提醒
    const result = await triggerDueReminders();

    return NextResponse.json({
      success: true,
      triggered: result.triggered,
      reminders: result.reminders.map(r => ({
        id: r.id,
        content: r.content,
        remindAt: r.remindAt,
      })),
    });
  } catch (error) {
    console.error('[API /cron/reminders] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '触发提醒失败' },
      { status: 500 }
    );
  }
}
