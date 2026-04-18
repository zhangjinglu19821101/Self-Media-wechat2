/**
 * 草稿文件管理 API
 * POST /api/drafts - 保存草稿
 * GET /api/drafts - 获取草稿列表
 * GET /api/drafts/[fileName] - 读取草稿
 * DELETE /api/drafts/[fileName] - 删除草稿
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  saveDraft,
  listDrafts,
  readDraft,
  deleteDraft,
  DraftFile,
} from '@/lib/services/draft-storage';

/**
 * POST /api/drafts
 * 保存草稿文件
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agentId,
      taskId,
      title,
      content,
      author,
      status = 'draft',
      complianceStatus,
      metadata,
    } = body;

    // 参数验证
    if (!agentId || !title || !content) {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误：agentId、title、content 必填',
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

    // 构建草稿对象
    const draft: DraftFile = {
      agentId,
      taskId,
      title,
      content,
      author,
      status,
      complianceStatus: agentId === 'insurance-d' ? (complianceStatus || 'pending') : undefined,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 保存草稿
    const filePath = await saveDraft(draft);

    return NextResponse.json({
      success: true,
      data: {
        filePath,
        draft: {
          agentId: draft.agentId,
          title: draft.title,
          author: draft.author,
          status: draft.status,
          createdAt: draft.createdAt,
          updatedAt: draft.updatedAt,
        },
      },
      message: '草稿已成功保存',
    });
  } catch (error: any) {
    console.error('保存草稿失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '保存草稿失败',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/drafts
 * 获取草稿列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    // 参数验证
    if (!agentId) {
      return NextResponse.json(
        {
          success: false,
          error: '参数错误：agentId 必填',
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

    // 获取草稿列表
    const drafts = await listDrafts(agentId);

    return NextResponse.json({
      success: true,
      data: {
        agentId,
        total: drafts.length,
        drafts: drafts.map((draft) => ({
          fileName: draft.fileName,
          title: draft.title,
          author: draft.author,
          status: draft.status,
          complianceStatus: draft.complianceStatus,
          createdAt: draft.createdAt,
          updatedAt: draft.updatedAt,
          taskId: draft.taskId,
          preview: draft.content ? draft.content.slice(0, 200) + '...' : '',
        })),
      },
    });
  } catch (error: any) {
    console.error('获取草稿列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '获取草稿列表失败',
      },
      { status: 500 }
    );
  }
}
