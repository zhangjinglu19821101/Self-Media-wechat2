import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/mcp/test-all
 * 测试所有 MCP 能力
 * 
 * 注意：此功能已迁移到新的 MCP 系统，请使用 /api/mcp/registry 接口查看可用的 MCP 能力
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: '此功能已迁移到新的 MCP 系统',
      message: '请使用 /api/mcp/registry 接口查看可用的 MCP 能力',
    },
    { status: 410 } // 410 Gone - 表示资源已不存在
  );
}
