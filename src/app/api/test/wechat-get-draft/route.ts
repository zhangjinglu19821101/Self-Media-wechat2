/**
 * 获取单个草稿的详细信息
 *
 * GET /api/test/wechat-get-draft
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDraftList, getAccessToken } from '@/lib/wechat-official-account/api';
import { getAccountById, WECHAT_API_CONFIG } from '@/config/wechat-official-account.config';

export async function GET(request: NextRequest) {
  try {
    const account = getAccountById('insurance-account');
    if (!account) {
      return NextResponse.json({ success: false, error: '账号不存在' });
    }

    const token = await getAccessToken(account);

    // 先获取草稿列表
    const draftList = await getDraftList(account, 0, 1);
    
    if (!draftList.items || draftList.items.length === 0) {
      return NextResponse.json({ success: false, error: '没有草稿' });
    }

    const mediaId = draftList.items[0].media_id;
    console.log('📄 使用 media_id:', mediaId);

    // 调用微信 API 获取单个草稿
    const url = `${WECHAT_API_CONFIG.baseUrl}/draft/get?access_token=${token}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_id: mediaId }),
    });

    const data = await response.json();

    if (data.errcode) {
      return NextResponse.json({
        success: false,
        error: data.errmsg,
        errcode: data.errcode,
      });
    }

    // 简化输出，只显示 news_item 的结构
    const newsItem = data.news_item?.[0];
    
    return NextResponse.json({
      success: true,
      mediaId,
      newsItemFields: newsItem ? Object.keys(newsItem) : [],
      newsItem: newsItem ? {
        title: newsItem.title,
        hasThumbMediaId: !!newsItem.thumb_media_id,
        thumbMediaId: newsItem.thumb_media_id ? '***' : null,
        showCoverPic: newsItem.show_cover_pic,
        author: newsItem.author,
        digest: newsItem.digest ? newsItem.digest.substring(0, 50) : null,
        contentLength: (newsItem.content || '').length,
      } : null,
      fullData: data,
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知' },
      { status: 500 }
    );
  }
}
