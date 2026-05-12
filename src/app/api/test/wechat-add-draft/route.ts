/**
 * 微信公众号添加草稿测试 API
 *
 * POST /api/test/wechat-add-draft
 *
 * 功能：
 * 1. 测试添加草稿
 * 2. 返回测试结果
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  addDraft,
  getAccessToken,
  formatArticleForWechat,
} from '@/lib/wechat-official-account/api';
import { getAccountById } from '@/config/wechat-official-account.config';

/**
 * POST - 测试微信添加草稿接口
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      accountId = 'insurance-account',
      title = '测试文章',
      content = '这是一篇测试文章的内容。\n\n## 第二部分\n\n这是第二部分的内容。',
      author = '测试作者',
      includeThumbMediaId = false,
      thumbMediaId = '',
    } = body;

    console.log('🧪 开始测试微信添加草稿接口');
    console.log(`📱 账号 ID: ${accountId}`);
    console.log(`📝 标题: ${title}`);
    console.log(`✍️ 作者: ${author}`);
    console.log(`🖼️ 包含 thumbMediaId: ${includeThumbMediaId}`);
    if (includeThumbMediaId) {
      console.log(`🖼️ thumbMediaId: ${thumbMediaId}`);
    }

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

    // 3. 格式化文章
    console.log('📝 格式化文章...');
    let draft = formatArticleForWechat(title, content, author);
    
    // 如果要求包含 thumbMediaId，就添加（即使是空字符串）
    if (includeThumbMediaId) {
      draft = {
        ...draft,
        thumbMediaId: thumbMediaId || '',
      };
    }
    
    console.log('📝 文章格式化完成，将要发送的数据:');
    console.log(JSON.stringify({ articles: [draft] }, null, 2));

    // 4. 测试添加草稿
    console.log('🚀 测试添加草稿...');
    const result = await addDraft(account, [draft]);
    console.log('✅ 草稿添加成功:', result);

    // 返回测试结果
    return NextResponse.json({
      success: true,
      data: {
        account: {
          id: account.id,
          name: account.name,
          appId: account.appId,
        },
        draftSent: {
          ...draft,
          content: draft.content.substring(0, 100) + '...', // 截断内容避免过长
        },
        result,
      },
      message: '微信添加草稿接口测试成功',
    });
  } catch (error) {
    console.error('❌ 测试微信添加草稿接口失败:', error);
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
