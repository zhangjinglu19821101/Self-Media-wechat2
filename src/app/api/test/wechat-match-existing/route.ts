/**
 * 测试匹配现有草稿结构
 *
 * POST /api/test/wechat-match-existing
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

    // 测试多种变体
    const testVariants = [
      {
        name: 'exact_empty_fields',
        articles: [{
          title: '',
          author: '',
          digest: '测试摘要',
          content: '<p>测试内容</p>',
          content_source_url: '',
          thumb_media_id: '',
          show_cover_pic: 0,
          need_open_comment: 0,
          only_fans_can_comment: 0,
        }]
      },
      {
        name: 'no_thumb_field',
        articles: [{
          title: '测试标题',
          author: '',
          digest: '测试摘要',
          content: '<p>测试内容</p>',
          content_source_url: '',
          show_cover_pic: 0,
          need_open_comment: 0,
          only_fans_can_comment: 0,
        }]
      },
      {
        name: 'minimum_working',
        articles: [{
          title: '测试标题',
          content: '<p>测试内容</p>',
        }]
      }
    ];

    const results = [];

    for (const variant of testVariants) {
      console.log(`🧪 测试: ${variant.name}`);
      
      const url = `${WECHAT_API_CONFIG.baseUrl}/draft/add?access_token=${token}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles: variant.articles }),
      });

      const data = await response.json();
      
      results.push({
        name: variant.name,
        success: !data.errcode,
        error: data.errcode ? data.errmsg : null,
        data: data.errcode ? null : data,
      });

      if (!data.errcode) {
        console.log(`✅ 成功: ${variant.name}`);
        // 找到第一个成功的就返回
        return NextResponse.json({
          success: true,
          workingVariant: variant.name,
          result: data,
          allResults: results,
        });
      }
    }

    return NextResponse.json({
      success: false,
      error: '所有变体都失败了',
      results,
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知' },
      { status: 500 }
    );
  }
}
