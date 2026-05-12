/**
 * 微信公众号调试 API - 测试不同参数组合
 *
 * POST /api/test/wechat-debug
 *
 * 功能：
 * 1. 测试不同的草稿参数组合
 * 2. 找出 invalid media_id hint 的具体原因
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/wechat-official-account/api';
import { getAccountById, WECHAT_API_CONFIG } from '@/config/wechat-official-account.config';

/**
 * POST - 微信调试接口
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      accountId = 'insurance-account',
      testCase = 'minimal', // minimal, withFields, withEmptyThumb, withInvalidThumb
    } = body;

    console.log('🔍 开始微信公众号 API 调试');
    console.log(`📱 账号 ID: ${accountId}`);
    console.log(`🧪 测试用例: ${testCase}`);

    // 1. 获取账号
    console.log('🔍 获取公众号账号...');
    const account = getAccountById(accountId);
    if (!account) {
      return NextResponse.json({
        success: false,
        error: `未找到账号: ${accountId}`,
      });
    }
    console.log('✅ 账号获取成功:', { id: account.id, name: account.name });

    // 2. 获取 Access Token
    console.log('🔑 获取 Access Token...');
    const token = await getAccessToken(account);
    console.log('✅ Access Token 获取成功');

    // 3. 根据测试用例构造不同的请求
    let articles: any[] = [];
    
    switch (testCase) {
      case 'minimal':
        // 最小化参数 - 只包含必需字段
        articles = [
          {
            title: '最小化测试文章',
            content: '<p>这是最小化测试的内容</p>',
          }
        ];
        break;
        
      case 'withFields':
        // 包含推荐字段，但不包含 thumbMediaId
        articles = [
          {
            title: '完整字段测试文章',
            author: '测试作者',
            digest: '这是文章摘要',
            content: '<p>这是完整字段测试的内容</p>',
            content_source_url: '',
            need_open_comment: 0,
            only_fans_can_comment: 0,
            show_cover_pic: 0,
          }
        ];
        break;
        
      case 'withEmptyThumb':
        // 包含空的 thumbMediaId
        articles = [
          {
            title: '空 thumbMediaId 测试',
            content: '<p>测试空 thumbMediaId</p>',
            thumb_media_id: '',
          }
        ];
        break;
        
      case 'withUndefinedThumb':
        // 显式设置为 undefined
        articles = [
          {
            title: 'undefined thumbMediaId 测试',
            content: '<p>测试 undefined thumbMediaId</p>',
            thumb_media_id: undefined,
          }
        ];
        break;
        
      case 'camelCase':
        // 使用驼峰命名（我们当前的方式）
        articles = [
          {
            title: '驼峰命名测试',
            author: '测试作者',
            digest: '文章摘要',
            content: '<p>驼峰命名测试内容</p>',
            contentSourceUrl: '',
            needOpenComment: 0,
            onlyFansCanComment: 0,
            showCoverPic: 0,
          }
        ];
        break;
        
      default:
        return NextResponse.json({
          success: false,
          error: `未知的测试用例: ${testCase}`,
        });
    }

    console.log('📤 将要发送到微信的请求体:');
    console.log(JSON.stringify({ articles }, null, 2));

    // 4. 直接调用微信 API（绕过我们的封装）
    const url = `${WECHAT_API_CONFIG.baseUrl}/draft/add?access_token=${token}`;
    
    console.log('🌐 调用微信 API:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ articles }),
      signal: AbortSignal.timeout(WECHAT_API_CONFIG.apiTimeout),
    });

    const responseText = await response.text();
    console.log('📥 微信 API 原始响应:', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      data = { rawResponse: responseText };
    }

    if (data.errcode) {
      console.error('❌ 微信 API 返回错误:', data);
      return NextResponse.json({
        success: false,
        error: `微信 API 错误: ${data.errmsg} (errcode: ${data.errcode})`,
        testCase,
        requestSent: { articles },
        wechatResponse: data,
      });
    }

    console.log('✅ 测试成功:', data);
    
    return NextResponse.json({
      success: true,
      testCase,
      requestSent: { articles },
      wechatResponse: data,
      message: `测试用例 "${testCase}" 执行成功`,
    });
    
  } catch (error) {
    console.error('❌ 调试失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
