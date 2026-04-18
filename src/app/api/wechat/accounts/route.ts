/**
 * 微信公众号配置管理 API
 * GET /api/wechat/accounts
 * POST /api/wechat/accounts
 * PUT /api/wechat/accounts/:id
 * DELETE /api/wechat/accounts/:id
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  defaultWechatConfig,
  WechatOfficialAccount,
} from '@/config/wechat-official-account.config';

/**
 * 模拟配置存储（实际应该保存到数据库或文件）
 */
let accountsStore = defaultWechatConfig;

/**
 * GET /api/wechat/accounts
 * 获取公众号配置列表
 */
export async function GET() {
  try {
    const accounts = Object.values(accountsStore);

    // 返回时不包含敏感信息
    const safeAccounts = accounts.map(acc => ({
      ...acc,
      appSecret: acc.appSecret ? '***' : '',  // 隐藏 AppSecret
    }));

    return NextResponse.json({
      success: true,
      data: {
        accounts: safeAccounts,
        total: accounts.length,
      },
    });
  } catch (error: any) {
    console.error('获取公众号配置失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '获取公众号配置失败',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/wechat/accounts
 * 添加公众号配置
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      name,
      appId,
      appSecret,
      agent,
      description,
      defaultAuthor,
      enabled = true,
    } = body;

    // 参数验证
    if (!id || !name || !appId || !appSecret || !agent) {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误：id、name、appId、appSecret、agent 必填',
        },
        { status: 400 }
      );
    }

    if (agent !== 'insurance-d' && agent !== 'agent-d' && agent !== 'both') {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误：agent 必须是 insurance-d、agent-d 或 both',
        },
        { status: 400 }
      );
    }

    // 检查 ID 是否已存在
    if (accountsStore[id]) {
      return NextResponse.json(
        {
          success: false,
          error: '公众号 ID 已存在',
        },
        { status: 400 }
      );
    }

    // 创建公众号配置
    const account: WechatOfficialAccount = {
      id,
      name,
      appId,
      appSecret,
      agent,
      description: description || '',
      enabled,
      defaultAuthor,
      defaultAuthorId: agent === 'insurance-d' ? 1 : 2,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    accountsStore[id] = account;

    return NextResponse.json({
      success: true,
      data: {
        ...account,
        appSecret: '***',  // 隐藏 AppSecret
      },
      message: '公众号配置添加成功',
    });
  } catch (error: any) {
    console.error('添加公众号配置失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '添加公众号配置失败',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/wechat/accounts/:id
 * 更新公众号配置
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // 检查公众号是否存在
    if (!accountsStore[id]) {
      return NextResponse.json(
        {
          success: false,
          error: '公众号不存在',
        },
        { status: 404 }
      );
    }

    // 更新配置
    accountsStore[id] = {
      ...accountsStore[id],
      ...body,
      id,  // 保持 ID 不变
      updatedAt: Date.now(),
    };

    return NextResponse.json({
      success: true,
      data: {
        ...accountsStore[id],
        appSecret: '***',  // 隐藏 AppSecret
      },
      message: '公众号配置更新成功',
    });
  } catch (error: any) {
    console.error('更新公众号配置失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '更新公众号配置失败',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/wechat/accounts/:id
 * 删除公众号配置
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 检查公众号是否存在
    if (!accountsStore[id]) {
      return NextResponse.json(
        {
          success: false,
          error: '公众号不存在',
        },
        { status: 404 }
      );
    }

    // 删除配置
    delete accountsStore[id];

    return NextResponse.json({
      success: true,
      message: '公众号配置删除成功',
    });
  } catch (error: any) {
    console.error('删除公众号配置失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '删除公众号配置失败',
      },
      { status: 500 }
    );
  }
}
