/**
 * POST /api/auth/token
 * 
 * 邮箱+密码登录，签发 Access Token + Refresh Token
 * 用于 App / 小程序登录
 */

import { NextRequest, NextResponse } from 'next/server';
import { tokenService } from '@/lib/auth/token-service';
import { VALID_DEVICE_TYPES } from '@/lib/db/schema/api-tokens';
import type { DeviceType } from '@/lib/db/schema/api-tokens';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, deviceType, deviceName, deviceId, workspaceId } = body;

    // 参数校验
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: '请填写邮箱和密码', code: 'MISSING_CREDENTIALS' },
        { status: 400 },
      );
    }

    if (!deviceType || !VALID_DEVICE_TYPES.includes(deviceType as DeviceType)) {
      return NextResponse.json(
        { success: false, error: `deviceType 必须是: ${VALID_DEVICE_TYPES.join(', ')}`, code: 'INVALID_DEVICE_TYPE' },
        { status: 400 },
      );
    }

    // 登录
    const result = await tokenService.loginWithEmail(email, password, {
      deviceType,
      deviceName: deviceName || undefined,
      deviceId: deviceId || undefined,
      workspaceId: workspaceId || undefined,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '登录失败';

    switch (message) {
      case 'INVALID_CREDENTIALS':
        return NextResponse.json(
          { success: false, error: '邮箱或密码错误', code: 'INVALID_CREDENTIALS' },
          { status: 401 },
        );
      case 'ACCOUNT_DISABLED':
        return NextResponse.json(
          { success: false, error: '账号已被禁用', code: 'ACCOUNT_DISABLED' },
          { status: 403 },
        );
      case 'ACCOUNT_LOCKED': {
        const lockoutMinutes = (error instanceof Error && 'lockoutMinutes' in error)
          ? (error as Error & { lockoutMinutes: number }).lockoutMinutes
          : 30;
        return NextResponse.json(
          {
            success: false,
            error: `账号已锁定，请${lockoutMinutes}分钟后重试`,
            code: 'ACCOUNT_LOCKED',
            lockoutMinutes,
          },
          { status: 423 },
        );
      }
      default:
        console.error('[Auth/Token] 登录失败:', error);
        return NextResponse.json(
          { success: false, error: '登录失败，请重试', code: 'INTERNAL_ERROR' },
          { status: 500 },
        );
    }
  }
}
