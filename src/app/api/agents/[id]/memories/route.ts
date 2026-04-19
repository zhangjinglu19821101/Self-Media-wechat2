import { NextRequest, NextResponse } from 'next/server';
import { agentMemory } from '@/lib/services/agent-memory';

/**
 * 获取 Agent 的记忆列表
 * GET /api/agents/:agentId/memories
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const memoryType = searchParams.get('type') || undefined;
    const tags = searchParams.get('tags')?.split(',') || [];
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const keyword = searchParams.get('keyword') || undefined;

    const { id: agentId } = await params;

    if (keyword) {
      // 关键词搜索
      const memories = await agentMemory.searchMemories({
        agentId,
        keyword,
        memoryType,
        tags,
        limit,
        offset,
      });

      return NextResponse.json({
        success: true,
        data: memories,
      });
    } else {
      // 获取所有记忆
      const memories = await agentMemory.getAgentMemories(agentId, {
        memoryType,
        tags,
        limit,
        offset,
      });

      return NextResponse.json({
        success: true,
        data: memories,
      });
    }
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
 * 创建新的记忆
 * POST /api/agents/:agentId/memories
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { id: agentId } = await params;

    const {
      memoryType,
      title,
      content,
      tags = [],
      importance = 0,
      source = 'auto',
      metadata = {},
    } = body;

    // 验证必需参数
    if (!memoryType || !title || !content) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必需参数：memoryType, title, content',
        },
        { status: 400 }
      );
    }

    const memory = await agentMemory.createMemory({
      agentId,
      memoryType,
      title,
      content,
      tags,
      importance,
      source,
      metadata,
    });

    return NextResponse.json({
      success: true,
      data: memory,
    });
  } catch (error) {
    console.error('创建记忆失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '创建记忆失败',
        message: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
