import { NextRequest, NextResponse } from 'next/server';
import { toolAutoRegistrar } from '@/lib/mcp/tool-auto-registrar';
import { toolRegistry } from '@/lib/mcp/tool-registry';

export async function GET(request: NextRequest) {
  console.log('[Refresh Tools API] ========== 手动刷新工具注册 ==========');

  try {
    // 手动调用刷新方法
    console.log('[Refresh Tools API] 步骤1：调用 toolAutoRegistrar.refresh()');
    const result = await toolAutoRegistrar.refresh();

    // 获取当前可用工具
    const toolInfos = toolRegistry.getToolInfos();

    console.log('[Refresh Tools API] 可用工具:', result.availableTools);
    console.log('[Refresh Tools API] 工具详情:', toolInfos.map(t => ({
      name: t.name,
      description: t.description
    })));

    return NextResponse.json({
      success: true,
      message: '工具刷新成功',
      availableTools: result.availableTools,
      toolCount: result.availableTools.length,
      toolInfos: toolInfos.map(t => ({
        name: t.name,
        description: t.description
      }))
    });

  } catch (error) {
    console.error('[Refresh Tools API] 刷新失败:', error);
    return NextResponse.json({
      success: false,
      error: '刷新失败',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
