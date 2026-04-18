import { NextRequest, NextResponse } from 'next/server';
import { agentMemory } from '@/lib/services/agent-memory';

/**
 * 手动添加 Agent 记忆（测试接口）
 *
 * POST /api/test/add-memory
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agentId = 'B',
      memoryType = 'experience',
      title = '测试记忆',
      content = '这是一个测试记忆',
      tags = ['test'],
      importance = 7,
      source = 'manual',
    } = body;

    console.log('🧪 添加 Agent 记忆:', { agentId, title, memoryType });

    const memory = await agentMemory.createMemory({
      agentId,
      memoryType: memoryType as any,
      title,
      content,
      tags,
      importance,
      source: source as any,
    });

    console.log(`✅ 记忆添加成功: ${memory.id}`);

    return NextResponse.json({
      success: true,
      data: memory,
      message: '记忆添加成功',
    });
  } catch (error) {
    console.error('❌ 添加记忆失败:', error);
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
 * 查询 Agent 记忆
 *
 * GET /api/test/add-memory?agentId=B
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId') || 'B';

    console.log(`🧪 查询 Agent ${agentId} 的记忆`);

    const memories = await agentMemory.getAgentMemories(agentId, {
      limit: 20,
    });

    console.log(`✅ 找到 ${memories.length} 条记忆`);

    return NextResponse.json({
      success: true,
      data: memories,
      count: memories.length,
    });
  } catch (error) {
    console.error('❌ 查询记忆失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
