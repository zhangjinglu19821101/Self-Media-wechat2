import { NextRequest, NextResponse } from 'next/server';
import { agentMemory } from '@/lib/services/agent-memory';

/**
 * 获取单个记忆
 * GET /api/agents/:agentId/memories/:memoryId
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memoryId: string }> }
) {
  try {
    const { memoryId } = await params;

    const memory = await agentMemory.getMemory(memoryId);

    if (!memory) {
      return NextResponse.json(
        {
          success: false,
          error: '记忆不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: memory,
    });
  } catch (error) {
    console.error('获取记忆失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取记忆失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

/**
 * 更新记忆
 * PUT /api/agents/:agentId/memories/:memoryId
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memoryId: string }> }
) {
  try {
    const body = await request.json();
    const { memoryId } = await params;

    const updates = {
      title: body.title,
      content: body.content,
      tags: body.tags,
      importance: body.importance,
      metadata: body.metadata,
    };

    // 移除 undefined 的字段
    Object.keys(updates).forEach(
      (key) => updates[key as keyof typeof updates] === undefined &&
      delete updates[key as keyof typeof updates]
    );

    const memory = await agentMemory.updateMemory(memoryId, updates);

    if (!memory) {
      return NextResponse.json(
        {
          success: false,
          error: '记忆不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: memory,
    });
  } catch (error) {
    console.error('更新记忆失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '更新记忆失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

/**
 * 删除记忆
 * DELETE /api/agents/:agentId/memories/:memoryId
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memoryId: string }> }
) {
  try {
    const { memoryId } = await params;

    await agentMemory.deleteMemory(memoryId);

    return NextResponse.json({
      success: true,
      message: '记忆删除成功',
    });
  } catch (error) {
    console.error('删除记忆失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '删除记忆失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
