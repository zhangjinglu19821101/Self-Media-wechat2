import { NextRequest, NextResponse } from 'next/server';
import { AgentMemoryService } from '@/lib/services/agent-memory';

/**
 * 搜索 Agent 的记忆
 * 用于测试记忆搜索功能
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agentId,
      keyword,
      memoryType,
      tags,
      minImportance,
      limit = 10
    } = body;

    const memoryService = new AgentMemoryService();

    const memories = await memoryService.searchMemories({
      agentId,
      keyword,
      memoryType,
      tags,
      minImportance,
      limit
    });

    return NextResponse.json({
      success: true,
      data: memories,
      count: memories.length
    });
  } catch (error) {
    console.error('搜索记忆失败:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
