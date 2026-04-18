/**
 * 风格沉淀定时任务 API
 *
 * GET /api/cron/deposition/run — 手动触发风格沉淀聚合（需 CRON_SECRET 鉴权）
 * GET /api/cron/deposition/status — 检查是否应该运行聚合（需 CRON_SECRET 鉴权）
 */

import { NextResponse } from 'next/server';
import { runDepositionAggregation, shouldRunDeposition } from '@/lib/cron/deposition-cron';

/** 🔴 Phase4修复(#8): 简单 API Key 鉴权 */
function validateAuth(request: Request): { valid: boolean; error?: string } {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // 未配置 CRON_SECRET 时允许本地开发环境调用
  if (!cronSecret) {
    if (process.env.COZE_PROJECT_ENV === 'PROD') {
      return { valid: false, error: 'CRON_SECRET not configured in production' };
    }
    return { valid: true }; // DEV 环境放行
  }

  // 支持 Bearer Token 和 Query Parameter 两种方式
  const token = authHeader?.replace('Bearer ', '') || '';
  if (token !== cronSecret) {
    return { valid: false, error: 'Invalid or missing authorization token' };
  }

  return { valid: true };
}

/**
 * 手动触发风格沉淀聚合任务 / 检查状态
 *
 * Auth: Bearer <CRON_SECRET> 或 ?token=<CRON_SECRET>
 */
export async function GET(request: Request) {
  // 🔴 Phase4修复(#8): 鉴权检查
  const authResult = validateAuth(request);
  if (!authResult.valid) {
    return NextResponse.json(
      { success: false, error: authResult.error || 'Unauthorized' },
      { status: 401 }
    );
  }
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'run';

  try {
    if (action === 'status') {
      // 检查是否应该运行
      const status = await shouldRunDeposition();
      return NextResponse.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
      });
    }

    // 执行聚合
    const maxArticles = searchParams.get('maxArticles')
      ? parseInt(searchParams.get('maxArticles')!, 10)
      : undefined;
    const expireDays = searchParams.get('expireDays')
      ? parseInt(searchParams.get('expireDays')!, 10)
      : undefined;

    const summary = await runDepositionAggregation({ maxArticles, expireDays });

    return NextResponse.json({
      success: summary.errors.length === 0,
      data: summary,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[API:/cron/deposition] 执行失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
