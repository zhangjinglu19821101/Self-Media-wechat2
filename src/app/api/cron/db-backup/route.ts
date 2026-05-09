/**
 * 数据库定时备份 Cron 任务
 * 
 * 触发方式：
 * - 外部定时任务（如 Kubernetes CronJob）调用此 API
 * - 每日凌晨2点触发全量备份
 * - 每4小时触发增量备份
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbBackupService } from '@/lib/services/db-backup-service';
import { getCurrentSchema } from '@/lib/db';

// ==================== GET/POST: 定时备份触发 ====================

export async function GET(request: NextRequest) {
  return handleBackupRequest(request);
}

export async function POST(request: NextRequest) {
  return handleBackupRequest(request);
}

async function handleBackupRequest(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'full' | 'incremental' || 'full';
    const secret = searchParams.get('secret');

    // 🔒 安全验证：防止未授权访问
    const expectedSecret = process.env.CRON_SECRET;
    if (expectedSecret && secret !== expectedSecret) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const schema = getCurrentSchema();
    const startTime = Date.now();

    console.log(`[Cron] 开始定时${type === 'full' ? '全量' : '增量'}备份: schema=${schema}`);

    // 执行备份
    const result = type === 'full'
      ? await dbBackupService.performFullBackup({
          schema,
          compress: true,
          retentionDays: 30,
        })
      : await dbBackupService.performIncrementalBackup({
          schema,
        });

    const duration = Date.now() - startTime;

    console.log(`[Cron] 定时备份完成: ${result.success ? '成功' : '失败'}, 耗时: ${Math.round(duration / 1000)}秒`);

    return NextResponse.json({
      success: result.success,
      data: {
        ...result,
        triggeredBy: 'cron',
      },
    });

  } catch (error) {
    console.error('[Cron] 定时备份失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
