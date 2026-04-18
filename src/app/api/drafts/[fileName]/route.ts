/**
 * 单个草稿管理 API
 * GET /api/drafts/[fileName] - 读取草稿
 * DELETE /api/drafts/[fileName] - 删除草稿
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  readDraft,
  deleteDraft,
} from '@/lib/services/draft-storage';

/**
 * GET /api/drafts/[fileName]
 * 读取指定草稿文件
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> }
) {
  try {
    const { fileName } = await params;
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    // 参数验证
    if (!agentId) {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误：agentId 必填（需要指定是哪个 Agent 的草稿）',
        },
        { status: 400 }
      );
    }

    // 验证 Agent ID
    if (!['D', 'insurance-d'].includes(agentId)) {
      return NextResponse.json(
        {
          success: false,
          error: '不支持的 Agent ID，仅支持: D, insurance-d',
        },
        { status: 400 }
      );
    }

    // 读取草稿
    const draft = await readDraft(agentId, decodeURIComponent(fileName));

    if (!draft) {
      return NextResponse.json(
        {
          success: false,
          error: '草稿不存在或读取失败',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: draft,
    });
  } catch (error: any) {
    console.error('读取草稿失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '读取草稿失败',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/drafts/[fileName]
 * 删除指定草稿文件
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> }
) {
  try {
    const { fileName } = await params;
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    // 参数验证
    if (!agentId) {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误：agentId 必填（需要指定是哪个 Agent 的草稿）',
        },
        { status: 400 }
      );
    }

    // 验证 Agent ID
    if (!['D', 'insurance-d'].includes(agentId)) {
      return NextResponse.json(
        {
          success: false,
          error: '不支持的 Agent ID，仅支持: D, insurance-d',
        },
        { status: 400 }
      );
    }

    // 删除草稿
    const success = await deleteDraft(agentId, decodeURIComponent(fileName));

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: '草稿不存在或删除失败',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '草稿已成功删除',
    });
  } catch (error: any) {
    console.error('删除草稿失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '删除草稿失败',
      },
      { status: 500 }
    );
  }
}
