/**
 * MCP Server API 路由
 * 暴露 MCP Server 的 Streamable HTTP 接口
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMCPServer } from '@/lib/mcp/server';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

let serverInstance: any = null;

/**
 * POST /api/mcp
 * 处理 MCP 请求
 */
export async function POST(request: NextRequest) {
  try {
    // 获取请求体
    const body = await request.json();

    // 获取 Agent ID（从请求头或请求体中）
    const agentId = request.headers.get('x-agent-id') || body.agentId || 'agent_b';

    // 创建或获取 MCP Server 实例
    if (!serverInstance) {
      serverInstance = await createMCPServer(agentId);
    }

    // 创建传输层
    const transport = new StreamableHTTPServerTransport(
      '/api/mcp',
      {
        // 配置 CORS
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-agent-id',
        },
      }
    );

    // 连接传输层
    await serverInstance.connect(transport);

    // 处理请求
    // 注意：这里需要根据实际的 MCP Server API 调整
    // Streamable HTTP 传输层会自动处理请求

    return NextResponse.json({
      success: true,
      message: 'MCP Server is running',
    });
  } catch (error) {
    console.error('[MCP API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/mcp
 * 处理 CORS 预检请求
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-agent-id',
    },
  });
}

/**
 * GET /api/mcp
 * 获取 MCP Server 信息
 */
export async function GET(request: NextRequest) {
  try {
    // 获取 Agent ID（从请求头中）
    const agentId = request.headers.get('x-agent-id') || 'agent_b';

    // 验证权限
    const allowedAgents = ['agent_b', 'Agent B', 'B'];
    if (!allowedAgents.includes(agentId)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Permission denied: Only Agent B can access MCP',
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      server: {
        name: 'agent-b-mcp-server',
        version: '1.0.0',
      },
      capabilities: {
        tools: {
          read_file: {
            description: '读取本地文件内容',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: {
                  type: 'string',
                  description: '文件路径',
                },
              },
              required: ['filePath'],
            },
          },
          write_file: {
            description: '写入本地文件',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: {
                  type: 'string',
                  description: '文件路径',
                },
                content: {
                  type: 'string',
                  description: '文件内容',
                },
              },
              required: ['filePath', 'content'],
            },
          },
          http_get: {
            description: '发送 HTTP GET 请求',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: '请求 URL',
                },
                headers: {
                  type: 'object',
                  description: '请求头（可选）',
                },
              },
              required: ['url'],
            },
          },
          http_post: {
            description: '发送 HTTP POST 请求',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: '请求 URL',
                },
                body: {
                  type: 'object',
                  description: '请求体',
                },
                headers: {
                  type: 'object',
                  description: '请求头（可选）',
                },
              },
              required: ['url', 'body'],
            },
          },
        },
      },
    });
  } catch (error) {
    console.error('[MCP API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
