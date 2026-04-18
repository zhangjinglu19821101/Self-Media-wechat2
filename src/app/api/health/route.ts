/**
 * Next.js 服务健康检查 API
 *
 * 用途：
 * 1. 监控服务状态
 * 2. 检查模块导入
 * 3. 检查缓存状态
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const checks = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {
        uptime: process.uptime(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
      },
    };

    // 检查关键模块是否可导入
    try {
      const commandDetector = await import('@/lib/command-detector');
      checks.checks.commandDetector = 'OK';
    } catch (error) {
      checks.checks.commandDetector = `ERROR: ${error.message}`;
      checks.status = 'degraded';
    }

    // 检查缓存状态
    try {
      const fs = await import('fs');
      const path = await import('path');
      const nextCacheDir = path.join(process.cwd(), '.next');
      const cacheExists = fs.existsSync(nextCacheDir);

      checks.checks.nextCache = cacheExists ? 'EXISTS' : 'NOT_EXISTS';
    } catch (error) {
      checks.checks.nextCache = `ERROR: ${error.message}`;
    }

    // 如果有失败的检查，返回 503
    if (checks.status === 'degraded') {
      return NextResponse.json(checks, { status: 503 });
    }

    return NextResponse.json(checks);
  } catch (error) {
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        status: 'unhealthy',
        error: error.message,
      },
      { status: 503 }
    );
  }
}
