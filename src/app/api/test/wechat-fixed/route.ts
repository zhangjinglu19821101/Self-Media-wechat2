/**
 * 直接测试修复后的代码
 *
 * POST /api/test/wechat-fixed
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/wechat-official-account/api';
import { getAccountById, WECHAT_API_CONFIG } from '@/config/wechat-official-account.config';

export async function POST(request: NextRequest) {
  try {
    const account = getAccountById('insurance-account');
    if (!account) {
      return NextResponse.json({ success: false, error: '账号不存在' });
    }

    const token = await getAccessToken(account);

    // 直接构造符合微信 API 要求的对象（下划线命名）
    const articles = [
      {
        title: '修复后的测试文章',
        author: '测试作者',
        digest: '这是文章摘要',
        content: '<p>这是修复后的测试内容</p>',
        content_source_url: '',
        show_cover_pic: 0,  // 关键：不显示封面
        need_open_comment: 0,
        only_fans_can_comment: 0,
      }
    ];

    console.log('📤 发送给微信的请求:');
    console.log(JSON.stringify({ articles }, null, 2));

    const url = `${WECHAT_API_CONFIG.baseUrl}/draft/add?access_token=${token}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articles }),
    });

    const data = await response.json();

    if (data.errcode) {
      console.error('❌ 微信 API 错误:', data);
      return NextResponse.json({
        success: false,
        error: data.errmsg,
        errcode: data.errcode,
      });
    }

    console.log('✅ 成功:', data);
    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知' },
      { status: 500 }
    );
  }
}
