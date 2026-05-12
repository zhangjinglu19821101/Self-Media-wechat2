import { NextRequest, NextResponse } from 'next/server';
import { AgentMemoryService } from '@/lib/services/agent-memory';

/**
 * 获取 Agent 的记忆列表
 * 用于测试记忆查询功能
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId');
    const memoryType = searchParams.get('memoryType') as any;
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: '缺少 agentId 参数' },
        { status: 400 }
      );
    }

    const memoryService = new AgentMemoryService();

    const memories = await memoryService.getAgentMemories(agentId, {
      memoryType,
      limit
    });

    return NextResponse.json({
      success: true,
      data: memories,
      count: memories.length
    });
  } catch (error) {
    console.error('获取记忆列表失败:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
