/**
 * GET /api/auth/token/list
 * 
 * 查询当前用户所有活跃 Token（多设备管理）
 * 支持 Cookie Session 认证（Web 端）和 Bearer Token 认证（App 端）
 */

import { NextRequest, NextResponse } from 'next/server';
import { tokenService } from '@/lib/auth/token-service';
import { getAccountId } from '@/lib/auth/context';

export async function GET(request: NextRequest) {
  try {
    // P0-3 修复：传入 request 支持 Bearer Token 认证（App 用户也可管理设备）
    const accountId = await getAccountId(request);
    if (!accountId) {
      return NextResponse.json(
        { success: false, error: '需要认证', code: 'AUTH_REQUIRED' },
        { status: 401 },
      );
    }

    const tokens = await tokenService.listActiveTokens(accountId);

    // 设备类型中文映射
    const deviceTypeLabels: Record<string, string> = {
      ios_app: 'iOS App',
      android_app: 'Android App',
      wechat_miniprogram: '微信小程序',
      other: '其他设备',
    };

    const formattedTokens = tokens.map(t => ({
      ...t,
      deviceTypeLabel: deviceTypeLabels[t.deviceType] || t.deviceType,
    }));

    return NextResponse.json({
      success: true,
      data: formattedTokens,
    });
  } catch (error) {
    console.error('[Auth/Token/List] 查询失败:', error);
    return NextResponse.json(
      { success: false, error: '查询失败', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
