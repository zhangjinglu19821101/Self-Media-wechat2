/**
 * 微信公众号合规审核测试 API
 *
 * 注意：此功能已迁移到新的任务系统
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * POST - 测试微信合规审核
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: '此功能已迁移到新的任务系统',
      message: '合规审核现在由 Agent T 自动执行',
    },
    { status: 410 }
  );
}
