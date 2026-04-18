import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentSubTasksMcpExecutions } from '@/lib/db/schema/agent-sub-tasks-mcp-executions';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('[检查 MCP 记录] 开始查询...');

    // 查询最新的 MCP 执行记录
    const latestMcp = await db
      .select()
      .from(agentSubTasksMcpExecutions)
      .orderBy(desc(agentSubTasksMcpExecutions.createdAt))
      .limit(10);

    const result = {
      count: latestMcp.length,
      records: latestMcp.map(m => ({
        id: m.id,
        commandResultId: m.commandResultId,
        orderIndex: m.orderIndex,
        attemptId: m.attemptId,
        toolName: m.toolName,
        actionName: m.actionName,
        resultStatus: m.resultStatus,
        createdAt: m.createdAt
      }))
    };

    console.log('[检查 MCP 记录] 查询完成:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[检查 MCP 记录] 错误:', error);
    return NextResponse.json(
      { 
        error: '查询失败', 
        message: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}
