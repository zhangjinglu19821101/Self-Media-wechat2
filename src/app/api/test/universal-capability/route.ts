/**
 * 通用能力边界判定测试 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { UniversalCapabilityChecker } from '@/lib/services/executor-capability-checker';
import { AgentCapabilityService } from '@/lib/services/agent-capability-service';

// POST /api/test/universal-capability
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, taskTitle, taskDescription } = body;

    if (!agentId || !taskTitle) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: agentId, taskTitle' },
        { status: 400 }
      );
    }

    console.log('[TestAPI] 测试能力边界判定:', { agentId, taskTitle });

    // 1. 获取Agent配置（验证配置是否存在）
    const agentConfig = await AgentCapabilityService.getConfig(agentId);
    console.log('[TestAPI] Agent配置:', {
      agentId: agentConfig.agentId,
      agentName: agentConfig.agentName,
      nativeCapabilities: agentConfig.nativeCapabilities.length,
      mcpCapabilities: agentConfig.preferredMcpCapabilities.length,
      rules: agentConfig.autoJudgeRules.length,
    });

    // 2. 执行能力边界判定
    const result = await UniversalCapabilityChecker.check({
      taskTitle,
      taskDescription: taskDescription || '',
      executorAgentId: agentId,
    });

    console.log('[TestAPI] 判定结果:', result);

    return NextResponse.json({
      success: true,
      data: result,
      agentConfig: {
        agentId: agentConfig.agentId,
        agentName: agentConfig.agentName,
        defaultAccountId: agentConfig.defaultAccountId,
      },
    });
  } catch (error) {
    console.error('[TestAPI] 测试失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '测试失败' },
      { status: 500 }
    );
  }
}

// GET /api/test/universal-capability
// 获取所有Agent配置列表
export async function GET() {
  try {
    const configs = await AgentCapabilityService.getAllConfigs();
    return NextResponse.json({
      success: true,
      data: configs.map(c => ({
        agentId: c.agentId,
        agentName: c.agentName,
        nativeCapabilities: c.nativeCapabilities.length,
        preferredMcpCapabilities: c.preferredMcpCapabilities.length,
        autoJudgeRules: c.autoJudgeRules.length,
        defaultAccountId: c.defaultAccountId,
      })),
    });
  } catch (error) {
    console.error('[TestAPI] 获取配置列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取配置列表失败' },
      { status: 500 }
    );
  }
}
