/**
 * 导出 Agent 配置（不含知识库内容）
 */

import { NextResponse } from 'next/server';
import { exportAgentConfigs } from '@/lib/agent-export-simple';

/**
 * GET /api/admin/export/configs
 * 导出所有 Agent 配置
 */
export async function GET() {
  try {
    const configs = await exportAgentConfigs();

    // 返回 JSON 响应
    return NextResponse.json({
      success: true,
      data: configs,
      message: '配置导出成功',
    });
  } catch (error) {
    console.error('导出配置失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '导出配置失败',
      },
      { status: 500 }
    );
  }
}
