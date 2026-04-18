/**
 * GET /api/agents/[id]/history
 * 获取对话历史
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/context';
import { conversationHistoryManager } from '@/storage/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!)
      : 50;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // 获取最近的对话历史（按时间升序排列）
    const history = await conversationHistoryManager.getSessionHistory(id, sessionId, {
      limit,
    });

    // 转换为 LLM 消息格式（按时间升序）
    const llmMessages = history
      .reverse()
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    return NextResponse.json({
      success: true,
      data: {
        messages: llmMessages,
        count: llmMessages.length,
      },
    });
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    return NextResponse.json(
      { success: false, error: '获取对话历史失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/agents/[id]/history
 * 删除对话历史
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
      const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const deletedCount = await conversationHistoryManager.deleteSessionHistory(
      id,
      sessionId
    );

    return NextResponse.json({
      success: true,
      data: {
        deletedCount,
      },
    });
  } catch (error) {
    console.error('Error deleting conversation history:', error);
    return NextResponse.json(
      { success: false, error: '删除对话历史失败' },
      { status: 500 }
    );
  }
}
