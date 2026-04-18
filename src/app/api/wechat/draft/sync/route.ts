/**
 * 微信公众号草稿同步 API
 *
 * POST /api/wechat/draft/sync
 * GET /api/wechat/draft/sync
 *
 * 功能：
 * 1. 同步微信公众号草稿到本地数据库
 * 2. 获取本地已同步的草稿列表
 * 3. 随机获取单个草稿并同步
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  syncWechatDraftsToLocal,
  getLocalWechatDrafts,
  syncRandomWechatDraft,
} from '@/lib/services/wechat-draft-sync';

/**
 * POST - 同步微信草稿到本地
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      mode = 'batch', // 'batch' | 'random'
      accountId = 'insurance-account',
      offset = 0,
      count = 20,
      taskId,
      creatorAgent,
      overwrite = false,
    } = body;

    console.log('🔄 收到同步微信草稿请求');
    console.log(`🎯 模式: ${mode}`);
    console.log(`📱 账号: ${accountId}`);
    console.log(`⏭️ 覆盖: ${overwrite}`);

    if (mode === 'random') {
      // 随机获取单个草稿
      console.log('🎲 随机获取单个草稿模式');
      const result = await syncRandomWechatDraft(accountId, {
        taskId,
        creatorAgent,
        overwrite,
      });

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error || '同步失败',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          articleId: result.articleId,
          draft: result.draft,
        },
        message: `成功随机获取并同步草稿: ${result.draft?.title || '无标题'}`,
      });
    } else {
      // 批量同步模式
      console.log(`📊 批量同步模式: offset=${offset}, count=${count}`);
      const result = await syncWechatDraftsToLocal(accountId, {
        offset,
        count,
        taskId,
        creatorAgent,
        overwrite,
      });

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error || '同步失败',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          total: result.total,
          synced: result.synced,
          failed: result.failed,
          results: result.results,
        },
        message: `同步完成：成功 ${result.synced} 个，失败 ${result.failed} 个`,
      });
    }
  } catch (error) {
    console.error('❌ 同步微信草稿失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

/**
 * GET - 获取本地已同步的草稿列表
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status') || undefined;

    console.log('📋 收到获取本地草稿请求');
    console.log(`📊 limit: ${limit}, offset: ${offset}`);
    if (status) {
      console.log(`📊 status: ${status}`);
    }

    const result = await getLocalWechatDrafts({
      limit,
      offset,
      status,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || '获取失败',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      total: result.total,
      message: `获取到 ${result.total} 个草稿`,
    });
  } catch (error) {
    console.error('❌ 获取本地草稿失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
