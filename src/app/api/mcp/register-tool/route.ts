/**
 * MCP 工具动态注册 API
 * 
 * 支持在运行时动态注册 MCP 工具，完全不需要重启应用！
 * 
 * 使用方式：
 * 1. POST /api/mcp/register-tool - 注册新工具
 * 2. GET /api/mcp/register-tool - 获取已注册工具列表
 * 3. DELETE /api/mcp/register-tool - 注销工具
 */

import { toolRegistry } from '@/lib/mcp/tool-registry';
import { NextRequest, NextResponse } from 'next/server';

// === 类型定义 ===

interface RegisterToolRequest {
  name: string;                    // 工具名称，如 'email', 'weather'
  description?: string;            // 工具描述（可选）
  tools: Record<string, (...args: any[]) => any>;  // 工具方法对象
}

interface UnregisterToolRequest {
  name: string;                    // 要注销的工具名称
}

// === API 路由 ===

/**
 * POST /api/mcp/register-tool
 * 
 * 动态注册新的 MCP 工具
 * 
 * 请求示例：
 * {
 *   "name": "email",
 *   "description": "邮件相关工具",
 *   "tools": {
 *     "sendEmail": function(params) {
 *       console.log("发送邮件:", params);
 *       return { success: true };
 *     }
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[API MCP Register] 收到注册请求');
    
    const body = await request.json();
    const { name, tools, description } = body as RegisterToolRequest;
    
    // 验证必需参数
    if (!name) {
      return NextResponse.json(
        { success: false, error: '缺少必需参数：name（工具名称）' },
        { status: 400 }
      );
    }
    
    if (!tools || typeof tools !== 'object') {
      return NextResponse.json(
        { success: false, error: '缺少必需参数：tools（工具方法对象）' },
        { status: 400 }
      );
    }
    
    // 验证 tools 是对象且包含方法
    const toolMethods = Object.keys(tools);
    if (toolMethods.length === 0) {
      return NextResponse.json(
        { success: false, error: 'tools 对象必须包含至少一个方法' },
        { status: 400 }
      );
    }
    
    // 注册工具
    toolRegistry.registerTool(name, tools, description);
    
    console.log(`[API MCP Register] ✅ 工具注册成功: ${name}`);
    console.log(`[API MCP Register] 工具方法: ${toolMethods.join(', ')}`);
    console.log(`[API MCP Register] 当前可用工具: ${toolRegistry.getAvailableTools().join(', ')}`);
    
    return NextResponse.json({
      success: true,
      message: `工具 "${name}" 注册成功`,
      data: {
        name,
        description,
        methods: toolMethods,
        registeredAt: new Date().toISOString(),
      },
      availableTools: toolRegistry.getAvailableTools(),
    });
  } catch (error: any) {
    console.error('[API MCP Register] ❌ 工具注册失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `工具注册失败: ${error.message}`,
        details: error.stack 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mcp/register-tool
 * 
 * 获取当前已注册的所有 MCP 工具列表
 */
export async function GET() {
  try {
    const availableTools = toolRegistry.getAvailableTools();
    const toolInfos = toolRegistry.getToolInfos();
    
    console.log('[API MCP Register] 获取工具列表');
    console.log('[API MCP Register] 可用工具:', availableTools);
    
    return NextResponse.json({
      success: true,
      data: {
        count: availableTools.length,
        tools: toolInfos.map(info => ({
          name: info.name,
          description: info.description,
          methods: info.instance ? Object.keys(info.instance).filter(key => 
            typeof info.instance[key] === 'function'
          ) : [],
        })),
      },
      availableTools,
    });
  } catch (error: any) {
    console.error('[API MCP Register] ❌ 获取工具列表失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `获取工具列表失败: ${error.message}` 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/mcp/register-tool
 * 
 * 注销指定的 MCP 工具
 * 
 * 请求示例：
 * {
 *   "name": "email"
 * }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body as UnregisterToolRequest;
    
    if (!name) {
      return NextResponse.json(
        { success: false, error: '缺少必需参数：name（工具名称）' },
        { status: 400 }
      );
    }
    
    // 检查工具是否存在
    if (!toolRegistry.hasTool(name)) {
      return NextResponse.json(
        { success: false, error: `工具 "${name}" 不存在` },
        { status: 404 }
      );
    }
    
    // 注销工具
    toolRegistry.unregisterTool(name);
    
    console.log(`[API MCP Register] ✅ 工具注销成功: ${name}`);
    console.log(`[API MCP Register] 当前可用工具: ${toolRegistry.getAvailableTools().join(', ')}`);
    
    return NextResponse.json({
      success: true,
      message: `工具 "${name}" 注销成功`,
      data: {
        name,
        unregisteredAt: new Date().toISOString(),
      },
      availableTools: toolRegistry.getAvailableTools(),
    });
  } catch (error: any) {
    console.error('[API MCP Register] ❌ 工具注销失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `工具注销失败: ${error.message}` 
      },
      { status: 500 }
    );
  }
}
