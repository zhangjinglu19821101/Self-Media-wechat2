/**
 * 插件管理 API
 * 用于管理插件的配置、使用和统计
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAgentPlugins, getAgentCapabilities, formatPluginConfigForPrompt } from '@/lib/plugin-system';
import { getPluginStats, getAllPluginsStats, formatPluginConfigForPrompt as formatConfigForPrompt } from '@/lib/plugin-manager';
import { AgentId } from '@/lib/agent-types';

/**
 * GET /api/plugins - 获取插件信息
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId') as AgentId | null;
    const pluginId = searchParams.get('pluginId');
    const type = searchParams.get('type'); // capabilities, config, stats

    if (type === 'capabilities' && agentId) {
      // 获取 Agent 的能力配置
      const capabilities = getAgentCapabilities(agentId);
      return NextResponse.json({
        success: true,
        data: capabilities,
      });
    }

    if (type === 'config' && agentId) {
      // 获取 Agent 的插件配置
      const config = formatConfigForPrompt(agentId);
      return NextResponse.json({
        success: true,
        agentId,
        config,
      });
    }

    if (type === 'stats' && pluginId) {
      // 获取指定插件的统计信息
      const stats = getPluginStats(pluginId);
      return NextResponse.json({
        success: true,
        pluginId,
        stats,
      });
    }

    if (type === 'stats') {
      // 获取所有插件的统计信息
      const stats = getAllPluginsStats();
      return NextResponse.json({
        success: true,
        stats: Object.fromEntries(stats),
      });
    }

    if (agentId) {
      // 获取 Agent 可使用的插件列表
      const plugins = getAgentPlugins(agentId);
      return NextResponse.json({
        success: true,
        agentId,
        pluginCount: plugins.length,
        plugins,
      });
    }

    // 获取所有插件信息（不包含敏感信息）
    return NextResponse.json({
      success: true,
      message: '请指定 agentId 参数',
    });
  } catch (error) {
    console.error('获取插件信息失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取插件信息失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/plugins - 执行插件
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pluginId, agentId, action, params } = body;

    if (!pluginId || !agentId || !action) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必需参数：pluginId、agentId、action',
        },
        { status: 400 }
      );
    }

    // 检查 Agent ID 是否有效
    if (!['A', 'B', 'C', 'D', 'insurance-c', 'insurance-d'].includes(agentId)) {
      return NextResponse.json(
        {
          success: false,
          error: '无效的 Agent ID',
        },
        { status: 400 }
      );
    }

    // 导入插件管理模块（避免循环依赖）
    const { executePlugin } = await import('@/lib/plugin-manager');

    // 执行插件
    const result = await executePlugin(pluginId, agentId, action, params);

    return NextResponse.json({
      success: result.success,
      data: result.data,
      error: result.error,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('执行插件失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '执行插件失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
