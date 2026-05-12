import { NextRequest, NextResponse } from 'next/server';
import { AgentMemoryService } from '@/lib/services/agent-memory';
import { eq } from 'drizzle-orm';
import { getDatabase, schema } from '@/lib/db';

/**
 * 删除 Agent 的记忆
 * 用于测试删除记忆功能
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, memoryId } = body;

    if (!agentId || !memoryId) {
      return NextResponse.json(
        { success: false, error: '缺少 agentId 或 memoryId 参数' },
        { status: 400 }
      );
    }

    const db = getDatabase();

    // 删除记忆（需要确保是该 Agent 的记忆）
    const result = await db
      .delete(schema.agentMemories)
      .where(
        eq(schema.agentMemories.id, memoryId)
      )
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: '未找到该记忆或无权删除' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '记忆删除成功',
      data: result[0]
    });
  } catch (error) {
    console.error('删除记忆失败:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
