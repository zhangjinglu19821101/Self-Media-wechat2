/**
 * POST /api/auth/wechat/miniprogram
 * 
 * 微信小程序登录端点
 * 
 * 流程：
 * 1. 小程序调用 wx.login() 获取 code
 * 2. 前端将 code 发送到此端点
 * 3. 后端用 code + appSecret 向微信服务端换取 openid
 * 4. 如果 openid 已绑定账户 → 直接签发 Token
 * 5. 如果 openid 未绑定 → 自动创建账户 + workspace → 签发 Token
 * 
 * 环境变量：
 * - WECHAT_MINI_APPID: 小程序 AppID
 * - WECHAT_MINI_SECRET: 小程序 AppSecret
 */

import { NextRequest, NextResponse } from 'next/server';
import { tokenService } from '@/lib/auth/token-service';

/** 微信 code2Session 接口 */
const WECHAT_CODE2SESSION_URL = 'https://api.weixin.qq.com/sns/jscode2session';

interface WechatCode2SessionResponse {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, deviceName, deviceId, workspaceId } = body;

    // 1. 参数校验
    if (!code) {
      return NextResponse.json(
        { success: false, error: '缺少微信登录 code', code: 'MISSING_CODE' },
        { status: 400 },
      );
    }

    // 2. 获取微信小程序配置
    const appId = process.env.WECHAT_MINI_APPID;
    const appSecret = process.env.WECHAT_MINI_SECRET;

    if (!appId || !appSecret) {
      console.error('[Auth/Wechat] 微信小程序未配置 WECHAT_MINI_APPID 或 WECHAT_MINI_SECRET');
      return NextResponse.json(
        { success: false, error: '微信小程序登录未启用', code: 'WECHAT_NOT_CONFIGURED' },
        { status: 503 },
      );
    }

    // 3. 用 code 换取 openid
    const url = `${WECHAT_CODE2SESSION_URL}?appid=${appId}&secret=${appSecret}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;

    const wxResponse = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000), // 10s 超时
    });

    if (!wxResponse.ok) {
      console.error('[Auth/Wechat] 微信服务端请求失败:', wxResponse.status);
      return NextResponse.json(
        { success: false, error: '微信服务端请求失败', code: 'WECHAT_API_ERROR' },
        { status: 502 },
      );
    }

    const wxData: WechatCode2SessionResponse = await wxResponse.json();

    if (wxData.errcode || !wxData.openid) {
      console.error('[Auth/Wechat] 微信 code2Session 失败:', wxData.errcode, wxData.errmsg);
      return NextResponse.json(
        {
          success: false,
          error: `微信登录失败: ${wxData.errmsg || '未知错误'}`,
          code: 'WECHAT_LOGIN_FAILED',
          wechatErrcode: wxData.errcode,
        },
        { status: 400 },
      );
    }

    // 4. 使用 openid 登录/注册
    // P1-9: 传递 session_key 供后续解密用户手机号等敏感数据
    const result = await tokenService.loginWithWechatOpenid(wxData.openid, {
      deviceType: 'wechat_miniprogram',
      deviceName: deviceName || '微信小程序',
      deviceId: deviceId || undefined,
      workspaceId: workspaceId || undefined,
      wechatSessionKey: wxData.session_key || undefined,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '微信登录失败';

    switch (message) {
      case 'MISSING_OPENID':
        return NextResponse.json(
          { success: false, error: '微信 OpenID 获取失败', code: 'MISSING_OPENID' },
          { status: 400 },
        );
      case 'ACCOUNT_DISABLED':
        return NextResponse.json(
          { success: false, error: '账号已被禁用', code: 'ACCOUNT_DISABLED' },
          { status: 403 },
        );
      case 'AUTO_REGISTER_FAILED':
        return NextResponse.json(
          { success: false, error: '自动注册失败，请重试', code: 'AUTO_REGISTER_FAILED' },
          { status: 500 },
        );
      default:
        console.error('[Auth/Wechat] 登录失败:', error);
        return NextResponse.json(
          { success: false, error: '微信登录失败，请重试', code: 'INTERNAL_ERROR' },
          { status: 500 },
        );
    }
  }
}
