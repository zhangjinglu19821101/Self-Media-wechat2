/**
 * 引擎状态API
 * GET /api/engine/status - 获取引擎状态
 * POST /api/engine/start - 启动引擎
 * POST /api/engine/stop - 停止引擎
 * POST /api/engine/reload - 重新加载规则
 */

import { NextRequest, NextResponse } from 'next/server';
import { decompositionEngine } from '@/lib/decomposition-engine';
import { ruleManager } from '@/lib/rule-manager';
import { permissionManager } from '@/lib/permission-manager';

/**
 * GET /api/engine/status - 获取引擎状态
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId');

    // 验证必填参数
    if (!agentId) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少agentId参数',
        },
        { status: 400 }
      );
    }

    // 只有Agent B可以查看引擎状态
    if (agentId !== 'B') {
      return NextResponse.json(
        {
          success: false,
          error: '只有Agent B可以查看引擎状态',
        },
        { status: 403 }
      );
    }

    // 获取引擎状态
    const engineStatus = decompositionEngine.getEngineStatus();

    // 获取规则统计
    const statistics = ruleManager.getStatistics();

    return NextResponse.json({
      success: true,
      data: {
        engine: engineStatus,
        statistics,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
