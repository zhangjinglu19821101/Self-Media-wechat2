/**
 * Agent 能力配置管理 API
 * 
 * 功能：
 * - 获取Agent配置
 * - 注册新Agent
 * - 更新Agent规则
 * - 列出所有Agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { AgentCapabilityService } from '@/lib/services/agent-capability-service';
import type { AutoJudgeRule } from '@/lib/db/schema';

// GET /api/admin/agent-capabilities?agentId=xxx
// GET /api/admin/agent-capabilities (获取所有)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    
    if (agentId) {
      // 获取单个Agent配置
      const config = await AgentCapabilityService.getConfig(agentId);
      return NextResponse.json({
        success: true,
        data: config
      });
    } else {
      // 获取所有Agent配置
      const configs = await AgentCapabilityService.getAllConfigs();
      return NextResponse.json({
        success: true,
        data: configs
      });
    }
  } catch (error) {
    console.error('[AgentCapabilitiesAPI] 获取配置失败:', error);
    return NextResponse.json(
      { success: false, error: '获取配置失败' },
      { status: 500 }
    );
  }
}

// POST /api/admin/agent-capabilities
// 注册新Agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, agentName, description, nativeCapabilities, preferredMcpCapabilities, autoJudgeRules, defaultAccountId } = body;
    
    if (!agentId || !agentName) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数: agentId, agentName' },
        { status: 400 }
      );
    }
    
    // 检查是否已存在
    const exists = await AgentCapabilityService.exists(agentId);
    if (exists) {
      return NextResponse.json(
        { success: false, error: `Agent ${agentId} 已存在` },
        { status: 409 }
      );
    }
    
    const config = await AgentCapabilityService.registerAgent({
      agentId,
      agentName,
      description,
      nativeCapabilities,
      preferredMcpCapabilities,
      autoJudgeRules,
      defaultAccountId
    });
    
    return NextResponse.json({
      success: true,
      data: config,
      message: `Agent ${agentId} 注册成功`
    });
  } catch (error) {
    console.error('[AgentCapabilitiesAPI] 注册Agent失败:', error);
    return NextResponse.json(
      { success: false, error: '注册Agent失败' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/agent-capabilities?agentId=xxx
// 更新Agent配置
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    
    if (!agentId) {
      return NextResponse.json(
        { success: false, error: '缺少参数: agentId' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const { agentName, description, nativeCapabilities, preferredMcpCapabilities, defaultAccountId, isActive } = body;
    
    await AgentCapabilityService.updateConfig(agentId, {
      agentName,
      description,
      nativeCapabilities,
      preferredMcpCapabilities,
      defaultAccountId,
      isActive
    });
    
    return NextResponse.json({
      success: true,
      message: `Agent ${agentId} 配置更新成功`
    });
  } catch (error) {
    console.error('[AgentCapabilitiesAPI] 更新配置失败:', error);
    return NextResponse.json(
      { success: false, error: '更新配置失败' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/agent-capabilities/rules?agentId=xxx
// 更新Agent规则
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    
    if (!agentId) {
      return NextResponse.json(
        { success: false, error: '缺少参数: agentId' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const { rules } = body;
    
    if (!Array.isArray(rules)) {
      return NextResponse.json(
        { success: false, error: 'rules 必须是数组' },
        { status: 400 }
      );
    }
    
    await AgentCapabilityService.updateRules(agentId, rules as AutoJudgeRule[]);
    
    return NextResponse.json({
      success: true,
      message: `Agent ${agentId} 规则更新成功，共 ${rules.length} 条规则`
    });
  } catch (error) {
    console.error('[AgentCapabilitiesAPI] 更新规则失败:', error);
    return NextResponse.json(
      { success: false, error: '更新规则失败' },
      { status: 500 }
    );
  }
}
