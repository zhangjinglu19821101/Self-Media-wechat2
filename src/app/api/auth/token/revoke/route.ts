/**
 * POST /api/auth/token/revoke
 * 
 * 吊销 Refresh Token（退出登录）
 * 支持吊销单个 Token 或所有 Token
 */

import { NextRequest, NextResponse } from 'next/server';
import { tokenService } from '@/lib/auth/token-service';
import { getAccountId } from '@/lib/auth/context';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refreshToken, revokeAll } = body;

    // 吊销所有 Token（需要认证）
    if (revokeAll) {
      // P0-3 修复：传入 request 支持 Bearer Token 认证
      const accountId = await getAccountId(request);
      if (!accountId) {
        return NextResponse.json(
          { success: false, error: '需要认证', code: 'AUTH_REQUIRED' },
          { status: 401 },
        );
      }
      const count = await tokenService.revokeAllTokens(accountId);
      return NextResponse.json({
        success: true,
        message: `已吊销 ${count} 个 Token`,
        data: { revokedCount: count },
      });
    }

    // 吊销单个 Token
    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: '缺少 refreshToken', code: 'MISSING_REFRESH_TOKEN' },
        { status: 400 },
      );
    }

    const revoked = await tokenService.revokeRefreshToken(refreshToken);

    return NextResponse.json({
      success: true,
      data: { revoked },
    });
  } catch (error) {
    console.error('[Auth/Token/Revoke] 吊销失败:', error);
    return NextResponse.json(
      { success: false, error: 'Token 吊销失败', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
