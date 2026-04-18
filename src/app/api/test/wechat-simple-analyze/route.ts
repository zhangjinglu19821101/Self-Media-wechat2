/**
 * 简化版本的现有草稿分析
 *
 * GET /api/test/wechat-simple-analyze
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDraftList } from '@/lib/wechat-official-account/api';
import { getAccountById } from '@/config/wechat-official-account.config';

export async function GET(request: NextRequest) {
  try {
    const account = getAccountById('insurance-account');
    if (!account) {
      return NextResponse.json({ success: false, error: '账号不存在' });
    }

    const draftList = await getDraftList(account, 0, 1);
    
    if (!draftList.items || draftList.items.length === 0) {
      return NextResponse.json({ success: false, error: '没有草稿' });
    }

    const firstItem = draftList.items[0];
    const newsItem = firstItem.content?.news_item?.[0];
    
    if (!newsItem) {
      return NextResponse.json({ success: false, error: '没有 news_item' });
    }

    // 只返回关键字段信息
    return NextResponse.json({
      success: true,
      hasThumbMediaId: !!newsItem.thumb_media_id,
      thumbMediaId: newsItem.thumb_media_id ? '***存在***' : '不存在',
      fields: Object.keys(newsItem),
      title: newsItem.title ? '有标题' : '无标题',
      contentLength: (newsItem.content || '').length,
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '未知' },
      { status: 500 }
    );
  }
}
