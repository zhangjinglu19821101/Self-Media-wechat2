import { NextRequest, NextResponse } from 'next/server';
import { getMemoryContext } from '@/lib/agent-memory-helper';

/**
 * 测试加载 Agent 记忆到 LLM Context
 * 模拟在 LLM 调用时加载 Agent 的相关记忆
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      agentId,
      task = "帮我写一篇文章",
      memoryTypes = ['experience'],
      maxMemories = 10,
      minImportance = 5
    } = body;

    if (!agentId) {
      return NextResponse.json(
        { success: false, error: '缺少 agentId 参数' },
        { status: 400 }
      );
    }

    // 调用 getMemoryContext 函数加载记忆
    const memoryContext = await getMemoryContext(
      agentId,
      task,
      {
        maxMemories,
        minImportance,
        memoryTypes
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        agentId,
        task,
        memoryContext
      }
    });
  } catch (error) {
    console.error('加载 Agent 记忆失败:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
