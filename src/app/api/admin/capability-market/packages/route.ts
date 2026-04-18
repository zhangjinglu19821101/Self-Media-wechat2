/**
 * 能力市场 API
 * 用于管理能力包和订阅
 */

import { NextRequest, NextResponse } from 'next/server';
import { capabilityMarket, initializePredefinedPackages } from '@/lib/capability-market';

// 初始化预定义包
initializePredefinedPackages();

/**
 * GET /api/admin/capability-market/packages
 * 列出能力包
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');
    const query = searchParams.get('query');

    let packages;

    if (query) {
      packages = capabilityMarket.searchPackages(query);
    } else {
      packages = capabilityMarket.listPackages({ domain: domain || undefined });
    }

    return NextResponse.json({
      success: true,
      data: packages,
      count: packages.length,
    });
  } catch (error) {
    console.error('获取能力包失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取能力包失败',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/capability-market/packages
 * 发布能力包
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    capabilityMarket.publishPackage(body);

    return NextResponse.json({
      success: true,
      message: '能力包发布成功',
    });
  } catch (error) {
    console.error('发布能力包失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '发布能力包失败',
      },
      { status: 500 }
    );
  }
}
