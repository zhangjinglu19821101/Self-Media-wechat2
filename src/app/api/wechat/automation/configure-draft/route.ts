/**
 * 自动配置草稿 API
 * POST /api/wechat/automation/configure-draft
 *
 * 在草稿上传后，通过 Playwright 自动设置：
 * - 原创声明
 * - 赞赏设置
 * - 合集设置
 *
 * 然后返回草稿编辑页 URL
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  autoConfigureDraft,
  hasValidCookie,
} from '@/lib/wechat-automation/wechat-automation';
import { getDraftDefaults, getAccountById } from '@/config/wechat-official-account.config';

export async function POST(request: NextRequest) {
  try {
    const { accountId, mediaId } = await request.json();

    if (!accountId || !mediaId) {
      return NextResponse.json(
        { success: false, error: 'accountId 和 mediaId 必填' },
        { status: 400 }
      );
    }

    // 检查 Cookie 是否有效
    if (!hasValidCookie(accountId)) {
      return NextResponse.json({
        success: false,
        error: 'Cookie 已过期，请先扫码登录公众号',
        needLogin: true,
      });
    }

    // 获取默认配置
    const account = getAccountById(accountId);
    const config = getDraftDefaults(accountId);

    // 执行自动配置
    const result = await autoConfigureDraft({
      accountId,
      mediaId,
      config,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
