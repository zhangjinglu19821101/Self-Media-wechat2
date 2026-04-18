/**
 * 分析现有草稿的结构
 *
 * GET /api/test/wechat-analyze-existing
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDraftList, getAccessToken } from '@/lib/wechat-official-account/api';
import { getAccountById } from '@/config/wechat-official-account.config';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const accountId = searchParams.get('accountId') || 'insurance-account';

    console.log('🔍 分析现有草稿结构');
    
    const account = getAccountById(accountId);
    if (!account) {
      return NextResponse.json({ success: false, error: '账号不存在' });
    }

    // 获取草稿列表
    const draftList = await getDraftList(account, 0, 1);
    
    if (draftList.item_count === 0 || !draftList.items || draftList.items.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: '没有现有草稿，无法分析结构',
        draftList 
      });
    }

    // 获取第一个草稿
    const firstDraft = draftList.items[0];
    console.log('📄 第一个草稿:', JSON.stringify(firstDraft, null, 2));

    // 提取 news_item 的结构
    const newsItem = firstDraft.content?.news_item?.[0];
    
    if (!newsItem) {
      return NextResponse.json({
        success: true,
        message: '草稿没有 news_item',
        firstDraft,
      });
    }

    // 分析 newsItem 的所有字段
    const fields = Object.keys(newsItem);
    const fieldTypes = fields.map(key => ({
      field: key,
      type: typeof newsItem[key],
      value: newsItem[key],
      isOptional: newsItem[key] === '' || newsItem[key] === null || newsItem[key] === undefined,
    }));

    console.log('📊 字段分析:', fieldTypes);

    return NextResponse.json({
      success: true,
      analysis: {
        totalFields: fields.length,
        fields: fieldTypes,
        exampleNewsItem: newsItem,
      },
      hint: '根据现有草稿结构，我们可以了解哪些字段是必需的',
    });

  } catch (error) {
    console.error('❌ 分析失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
