/**
 * 微信公众号草稿箱测试 API
 *
 * GET /api/test/wechat-draft
 *
 * 功能：
 * 1. 测试获取草稿列表
 * 2. 返回测试结果
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDraftList, getAccessToken } from '@/lib/wechat-official-account/api';
import { getAccountById } from '@/config/wechat-official-account.config';

/**
 * GET - 测试微信草稿箱接口
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const accountId = searchParams.get('accountId') || 'insurance-account';
    const offset = parseInt(searchParams.get('offset') || '0');
    const count = parseInt(searchParams.get('count') || '10');

    console.log('🧪 开始测试微信草稿箱接口');
    console.log(`📱 账号 ID: ${accountId}`);
    console.log(`📊 offset: ${offset}`);
    console.log(`📊 count: ${count}`);

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

    // 2. 测试获取 Access Token
    console.log('🔑 测试获取 Access Token...');
    const token = await getAccessToken(account);
    console.log('✅ Access Token 获取成功:', token.substring(0, 20) + '...');

    // 3. 测试获取草稿列表
    console.log('📋 测试获取草稿列表...');
    const draftList = await getDraftList(account, offset, count);
    console.log('✅ 草稿列表获取成功:', draftList);

    // 返回测试结果
    return NextResponse.json({
      success: true,
      data: {
        account: {
          id: account.id,
          name: account.name,
          appId: account.appId,
        },
        draftList,
      },
      message: '微信草稿箱接口测试成功',
    });
  } catch (error) {
    console.error('❌ 测试微信草稿箱接口失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
