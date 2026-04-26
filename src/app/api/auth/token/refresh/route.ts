/**
 * POST /api/auth/token/refresh
 * 
 * 使用 Refresh Token 换取新的 Access Token + Refresh Token
 * 旧 Refresh Token 立即吊销（轮转模式）
 */

import { NextRequest, NextResponse } from 'next/server';
import { tokenService } from '@/lib/auth/token-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: '缺少 refreshToken', code: 'MISSING_REFRESH_TOKEN' },
        { status: 400 },
      );
    }

    const result = await tokenService.rotateRefreshToken(refreshToken);

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Refresh Token 无效或已过期，请重新登录', code: 'INVALID_REFRESH_TOKEN' },
        { status: 401 },
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Auth/Token/Refresh] 刷新失败:', error);
    return NextResponse.json(
      { success: false, error: 'Token 刷新失败', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
