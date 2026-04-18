
/**
 * MCP 搜索能力测试 API
 *
 * POST /api/test/mcp-web-search
 *
 * 功能：
 * 1. 模拟 Agent B 生成标准指令
 * 2. 调用 MCP 执行器执行搜索
 * 3. 支持 3 种搜索类型测试
 *
 * 测试场景：
 * - 场景 1：网页搜索（ID 16）
 * - 场景 2：网页搜索带摘要（ID 17）
 * - 场景 3：图片搜索（ID 18）
 */

import { NextRequest, NextResponse } from 'next/server';
import { MCPCapabilityExecutorFactory } from '@/lib/mcp/mcp-executor';
import { db } from '@/lib/db';
import { capabilityList } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// 确保 MCP 能力注册
import '@/lib/mcp/registry';

/**
 * 模拟 Agent B 生成标准指令
 */
function generateAgentBResponse(spec, businessData) {
  const response = {};

  // 设置触发关键字和值
  response[spec.trigger_key] = spec.trigger_value;

  // 填充必填参数
  spec.required_params.forEach((param) => {
    const paramName = param.param_name;
    if (businessData[paramName] !== undefined) {
      response[paramName] = businessData[paramName];
    } else if (!param.optional) {
      response[paramName] = param.example_value;
    }
  });

  return response;
}

/**
 * POST - 测试 MCP 搜索能力
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      testScenario = 1,
      capabilityId,
      query,
      count = 10,
    } = body;

    console.log('🧪 开始测试 MCP 搜索能力');
    console.log(`🎯 测试场景: ${testScenario}`);

    // 根据测试场景设置参数
    let testCapabilityId = capabilityId;
    let testQuery = query;
    let testCount = count;

    switch (testScenario) {
      case 1:
        testCapabilityId = 16;
        testQuery = testQuery || '2025年保险市场趋势';
        console.log('📋 场景 1：网页搜索（ID 16）');
        break;

      case 2:
        testCapabilityId = 17;
        testQuery = testQuery || '2025年保险市场趋势';
        console.log('📋 场景 2：网页搜索带摘要（ID 17）');
        break;

      case 3:
        testCapabilityId = 18;
        testQuery = testQuery || '保险产品宣传图';
        console.log('📋 场景 3：图片搜索（ID 18）');
        break;

      default:
        console.log('📋 使用自定义参数');
    }

    // 步骤 1：从数据库查询 capability_list 表获取 agent_response_spec
    console.log('🔍 步骤 1：从数据库查询 capability_list...');
    const capability = await db.query.capabilityList.findFirst({
      where: eq(capabilityList.id, testCapabilityId),
    });

    if (!capability) {
      return NextResponse.json(
        {
          success: false,
          error: `未找到 capability_id = ${testCapabilityId} 的 MCP 能力`,
        },
        { status: 404 }
      );
    }

    console.log('✅ 步骤 1 完成：找到 MCP 能力');

    // 步骤 2：模拟 Agent B 生成标准指令
    console.log('🤖 步骤 2：模拟 Agent B 生成标准指令...');
    const businessData = {
      query: testQuery,
      count: testCount,
    };
    const agentBResponse = generateAgentBResponse(capability.agentResponseSpec, businessData);

    console.log('✅ 步骤 2 完成：Agent B 返回指令');
    console.log('📤 Agent B 返回:', JSON.stringify(agentBResponse, null, 2));

    // 步骤 3：获取 MCP 执行器并执行
    console.log('⚡ 步骤 3：获取 MCP 执行器并执行...');
    const executor = MCPCapabilityExecutorFactory.getExecutor(testCapabilityId);

    if (!executor) {
      return NextResponse.json(
        {
          success: false,
          error: `未找到 capability_id = ${testCapabilityId} 的 MCP 执行器`,
        },
        { status: 404 }
      );
    }

    console.log('✅ 步骤 3 完成：找到 MCP 执行器');

    // 步骤 4：执行 MCP 能力
    console.log('🚀 步骤 4：执行 MCP 能力...');
    const result = await executor.call(
      {
        capabilityId: testCapabilityId,
        agentBResponse,
        businessData,
      },
      capability.agentResponseSpec
    );

    console.log('✅ 步骤 4 完成：MCP 执行完成');
    console.log('📥 MCP 执行结果:', JSON.stringify(result, null, 2));

    // 返回测试结果
    return NextResponse.json({
      success: true,
      data: {
        testScenario,
        testParams: {
          capabilityId: testCapabilityId,
          query: testQuery,
          count: testCount,
        },
        capability: {
          id: capability.id,
          capabilityType: capability.capabilityType,
          functionDesc: capability.functionDesc,
        },
        agentBResponse,
        mcpExecutionResult: result,
      },
      message: 'MCP 搜索能力测试完成',
    });
  } catch (error) {
    console.error('❌ MCP 搜索能力测试失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '测试失败',
      },
      { status: 500 }
    );
  }
}

/**
 * GET - 获取测试 API 信息
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    name: 'mcp-web-search',
    description: 'MCP 搜索能力测试 API',
    testScenarios: [
      { id: 1, name: '网页搜索（ID 16）', capabilityId: 16 },
      { id: 2, name: '网页搜索带摘要（ID 17）', capabilityId: 17 },
      { id: 3, name: '图片搜索（ID 18）', capabilityId: 18 },
    ],
    usage: {
      method: 'POST',
      endpoint: '/api/test/mcp-web-search',
      body: {
        testScenario: '1-3 测试场景',
        capabilityId: '能力 ID（可选，指定测试场景时不需要）',
        query: '搜索关键词（可选）',
        count: '返回结果数量（可选，默认 10）',
      },
    },
  });
}

