import { NextRequest, NextResponse } from 'next/server';
import { conversationHistoryService } from '@/lib/services/conversation-history';
import postgres from 'postgres';

/**
 * GET /api/agents/[id]/commands
 * 获取 Agent 收到的所有指令（来自其他 Agent）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let client: postgres.Sql | null = null;

  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');

    // 使用原生 SQL 查询该 Agent 收到的所有指令
    const connectionString = process.env.DATABASE_URL || '';
    client = postgres(connectionString, { ssl: 'require' });

    // 查询所有发给该 Agent 的对话会话（type = 'agent-to-agent'）
    const conversations = await client.unsafe(`
      SELECT DISTINCT c.id, c.session_id, c.metadata, c.created_at
      FROM conversations c
      WHERE c.agent_id = $1
        AND c.metadata->>'type' = 'agent-to-agent'
      ORDER BY c.created_at DESC
      LIMIT $2
    `, [id, limit]);

    // 如果没有找到任何指令，返回空列表
    if (!conversations || conversations.length === 0) {
      if (client) {
        await client.end();
      }
      return NextResponse.json({
        success: true,
        data: {
          commands: [],
          count: 0,
        },
      });
    }

    // 获取每个会话的消息
    const commands = [];
    for (const conv of conversations) {
      const messages = await client.unsafe(`
        SELECT m.id, m.role, m.content, m.metadata, m.created_at
        FROM messages m
        WHERE m.conversation_id = $1
          AND m.metadata->>'isCommand' = 'true'
        ORDER BY m.created_at ASC
      `, [conv.id]);

      if (messages && messages.length > 0) {
        const msg = messages[0]; // 取第一条（指令）
        commands.push({
          id: msg.id,
          fromAgentId: conv.metadata?.fromAgentId || 'unknown',
          toAgentId: id,
          commandType: conv.metadata?.commandType || 'instruction',
          priority: conv.metadata?.priority || 'normal',
          content: msg.content,
          sessionId: conv.session_id,
          createdAt: conv.created_at,
        });
      }
    }

    if (client) {
      await client.end();
    }

    return NextResponse.json({
      success: true,
      data: {
        commands,
        count: commands.length,
      },
    });
  } catch (error) {
    console.error('Error fetching agent commands:', error);
    if (client) {
      await client.end();
    }
    return NextResponse.json(
      {
        success: false,
        error: '获取指令列表失败',
      },
      { status: 500 }
    );
  }
}
