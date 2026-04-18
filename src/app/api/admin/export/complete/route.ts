/**
 * 导出完整 Agent 数据（包含知识库内容）
 */

import { NextResponse } from 'next/server';
import { exportAllAgents, exportAgentComplete } from '@/lib/agent-export';

/**
 * GET /api/admin/export/complete
 * 导出所有 Agent 完整数据（包含知识库）
 *
 * 查询参数：
 * - agentId: 可选，指定导出某个 Agent
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    let data;
    if (agentId) {
      // 导出指定 Agent
      data = await exportAgentComplete(agentId, true);
    } else {
      // 导出所有 Agent
      data = await exportAllAgents(true);
    }

    return NextResponse.json({
      success: true,
      data,
      message: agentId ? `Agent ${agentId} 导出成功` : '所有 Agent 导出成功',
    });
  } catch (error) {
    console.error('导出完整数据失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '导出失败',
      },
      { status: 500 }
    );
  }
}
