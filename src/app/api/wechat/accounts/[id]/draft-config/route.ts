/**
 * 微信公众号草稿默认配置 API
 * GET /api/wechat/accounts/:id/draft-config - 获取草稿默认配置
 * PUT /api/wechat/accounts/:id/draft-config - 更新草稿默认配置
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  defaultWechatConfig,
  WechatDraftDefaults,
} from '@/config/wechat-official-account.config';

// 内存存储（实际应该保存到数据库）
const draftConfigsStore: Record<string, WechatDraftDefaults> = {
  'insurance-account': {
    author: '智者足迹-探寻',
    isOriginal: 1,
    needOpenComment: 1,
    onlyFansCanComment: 0,
    canReward: 1,
    showCoverPic: 0,
  },
  'ai-tech-account': {
    author: 'AI技术',
    isOriginal: 0,
    needOpenComment: 1,
    onlyFansCanComment: 0,
    canReward: 0,
    showCoverPic: 0,
  },
};

/**
 * GET /api/wechat/accounts/:id/draft-config
 * 获取指定公众号的草稿默认配置
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 检查公众号是否存在
    if (!defaultWechatConfig[id]) {
      return NextResponse.json(
        {
          success: false,
          error: '公众号不存在',
        },
        { status: 404 }
      );
    }

    // 获取配置（如果不存在则返回默认值）
    const config = draftConfigsStore[id] || defaultWechatConfig[id]?.draftDefaults || {
      author: defaultWechatConfig[id]?.defaultAuthor || '原创',
      isOriginal: 0,
      needOpenComment: 1,
      onlyFansCanComment: 0,
      canReward: 0,
      showCoverPic: 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        accountId: id,
        accountName: defaultWechatConfig[id]?.name,
        ...config,
      },
    });
  } catch (error: any) {
    console.error('获取草稿配置失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '获取草稿配置失败',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/wechat/accounts/:id/draft-config
 * 更新指定公众号的草稿默认配置
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 检查公众号是否存在
    if (!defaultWechatConfig[id]) {
      return NextResponse.json(
        {
          success: false,
          error: '公众号不存在',
        },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      author,
      isOriginal,
      needOpenComment,
      onlyFansCanComment,
      canReward,
      showCoverPic,
    } = body;

    // 参数验证
    if (typeof author !== 'string' || !author.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误：author 必填且不能为空',
        },
        { status: 400 }
      );
    }

    // 构建新配置
    const newConfig: WechatDraftDefaults = {
      author: author.trim(),
      isOriginal: isOriginal === 1 ? 1 : 0,
      needOpenComment: needOpenComment === 0 ? 0 : 1,  // 默认开启
      onlyFansCanComment: onlyFansCanComment === 1 ? 1 : 0,
      canReward: canReward === 1 ? 1 : 0,
      showCoverPic: showCoverPic === 1 ? 1 : 0,
    };

    // 保存配置
    draftConfigsStore[id] = newConfig;

    console.log(`✅ 已保存公众号 ${id} 的草稿默认配置:`, newConfig);

    return NextResponse.json({
      success: true,
      data: {
        accountId: id,
        accountName: defaultWechatConfig[id]?.name,
        ...newConfig,
      },
      message: '草稿默认配置已保存',
    });
  } catch (error: any) {
    console.error('保存草稿配置失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '保存草稿配置失败',
      },
      { status: 500 }
    );
  }
}
