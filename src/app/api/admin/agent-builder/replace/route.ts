/**
 * Agent 能力替换 API
 * 用于快速替换行业能力
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentBuilder } from '@/lib/agent-builder';

/**
 * POST /api/admin/agent-builder/replace
 * 快速替换行业能力
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, newDomain } = body;

    if (!agentId || !newDomain) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必要参数: agentId, newDomain',
        },
        { status: 400 }
      );
    }

    // 替换领域能力
    const agent = agentBuilder.replaceDomainCapabilities(agentId, newDomain);

    return NextResponse.json({
      success: true,
      data: agent,
      message: `Agent ${agentId} 的领域能力已替换为 ${newDomain}`,
    });
  } catch (error) {
    console.error('替换领域能力失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '替换领域能力失败',
      },
      { status: 500 }
    );
  }
}
