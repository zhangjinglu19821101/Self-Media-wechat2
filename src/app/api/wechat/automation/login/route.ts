/**
 * 扫码登录 API
 * POST /api/wechat/automation/login
 * GET  /api/wechat/automation/login?accountId=xxx  → 检查登录状态
 *
 * 流程：
 * 1. POST → 发起扫码登录，返回二维码 URL
 * 2. 前端展示二维码，轮询 GET 检查状态
 * 3. 扫码确认后，Cookie 自动保存
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  initiateQRLogin,
  pollLoginStatus,
  hasValidCookie,
} from '@/lib/wechat-automation/wechat-automation';

// 简单的 uuid 存储
const loginSessions = new Map<string, { uuid: string; accountId: string; createdAt: number }>();

export async function POST(request: NextRequest) {
  try {
    const { accountId } = await request.json();

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: 'accountId 必填' },
        { status: 400 }
      );
    }

    // 发起扫码登录
    const result = await initiateQRLogin(accountId);

    if (result.success && result.uuid) {
      // 保存 session
      loginSessions.set(accountId, {
        uuid: result.uuid,
        accountId,
        createdAt: Date.now(),
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const accountId = request.nextUrl.searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: 'accountId 必填' },
        { status: 400 }
      );
    }

    // 先检查是否已有有效 Cookie
    if (hasValidCookie(accountId)) {
      return NextResponse.json({
        success: true,
        status: 'confirmed',
        message: '已登录，Cookie 有效',
      });
    }

    // 获取登录 session
    const session = loginSessions.get(accountId);
    if (!session) {
      return NextResponse.json({
        success: false,
        status: 'expired',
        message: '请先发起扫码登录',
      });
    }

    // 轮询登录状态
    const result = await pollLoginStatus(accountId, session.uuid);

    if (result.status === 'confirmed') {
      // 登录成功，清理 session
      loginSessions.delete(accountId);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
