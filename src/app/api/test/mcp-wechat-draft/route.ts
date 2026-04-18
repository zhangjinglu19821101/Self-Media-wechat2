/**
 * MCP 微信公众号-添加草稿 测试 API
 *
 * POST /api/test/mcp-wechat-draft
 *
 * 功能：
 * 1. 模拟 Agent B 生成标准指令
 * 2. 调用 MCP 执行器执行微信公众号添加草稿
 * 3. 支持多种账号匹配方式测试
 *
 * 测试场景：
 * - 场景 1：通过 accountName 精确匹配（insurance-account）
 * - 场景 2：通过 accountName 精确匹配（ai-tech-account）
 * - 场景 3：通过 agent 类型自动匹配（insurance-d）
 * - 场景 4：通过 agent 类型自动匹配（agent-d）
 * - 场景 5：都不传，返回可用账号列表
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
 * @param spec agent_response_spec 规范
 * @param businessData 业务数据
 * @returns Agent B 返回的标准指令
 */
function generateAgentBResponse(
  spec: any,
  businessData: Record<string, any>
): Record<string, any> {
  const response: Record<string, any> = {};

  // 设置触发关键字和值
  response[spec.trigger_key] = spec.trigger_value;

  // 填充必填参数
  spec.required_params.forEach((param: any) => {
    const paramName = param.param_name;
    // 如果业务数据中有值，使用业务数据；否则跳过 optional 参数
    if (businessData[paramName] !== undefined) {
      response[paramName] = businessData[paramName];
    } else if (!param.optional) {
      response[paramName] = param.example_value;
    }
  });

  return response;
}

/**
 * POST - 测试 MCP 微信公众号添加草稿
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      testScenario = 1, // 测试场景：1-5
      accountName,
      agent,
      title = '测试文章：MCP 能力测试',
      content = `# 测试文章

这是一篇用于测试 MCP 能力的文章。

## 第一部分

这是第一部分的内容。

## 第二部分

这是第二部分的内容。

## 总结

这是文章的总结。`,
    } = body;

    console.log('🧪 开始测试 MCP 微信公众号-添加草稿');
    console.log(`🎯 测试场景: ${testScenario}`);

    // 根据测试场景设置参数
    let testAccountName = accountName;
    let testAgent = agent;

    switch (testScenario) {
      case 1:
        testAccountName = 'insurance-account';
        testAgent = undefined;
        console.log('📋 场景 1：通过 accountName 精确匹配（insurance-account）');
        break;
      case 2:
        testAccountName = 'ai-tech-account';
        testAgent = undefined;
        console.log('📋 场景 2：通过 accountName 精确匹配（ai-tech-account）');
        break;
      case 3:
        testAccountName = undefined;
        testAgent = 'insurance-d';
        console.log('📋 场景 3：通过 agent 类型自动匹配（insurance-d）');
        break;
      case 4:
        testAccountName = undefined;
        testAgent = 'agent-d';
        console.log('📋 场景 4：通过 agent 类型自动匹配（agent-d）');
        break;
      case 5:
        testAccountName = undefined;
        testAgent = undefined;
        console.log('📋 场景 5：都不传，返回可用账号列表');
        break;
      default:
        console.log('📋 使用自定义参数');
    }

    // 步骤 1：从数据库查询 capability_list 表获取 agent_response_spec
    console.log('🔍 步骤 1：从数据库查询 capability_list...');
    const capability = await db.query.capabilityList.findFirst({
      where: eq(capabilityList.id, 11),
    });

    if (!capability) {
      return NextResponse.json(
        {
          success: false,
          error: '未找到 capability_id = 11 的 MCP 能力',
        },
        { status: 404 }
      );
    }

    console.log('✅ 步骤 1 完成：找到 MCP 能力');

    // 步骤 2：模拟 Agent B 生成标准指令
    console.log('🤖 步骤 2：模拟 Agent B 生成标准指令...');
    const businessData = {
      accountName: testAccountName,
      agent: testAgent,
      title,
      content,
    };
    const agentBResponse = generateAgentBResponse(capability.agentResponseSpec, businessData);

    console.log('✅ 步骤 2 完成：Agent B 返回指令');
    console.log('📤 Agent B 返回:', JSON.stringify(agentBResponse, null, 2));

    // 步骤 3：获取 MCP 执行器并执行
    console.log('⚡ 步骤 3：获取 MCP 执行器并执行...');
    const executor = MCPCapabilityExecutorFactory.getExecutor(11);

    if (!executor) {
      return NextResponse.json(
        {
          success: false,
          error: '未找到 capability_id = 11 的 MCP 执行器',
        },
        { status: 404 }
      );
    }

    console.log('✅ 步骤 3 完成：找到 MCP 执行器');

    // 步骤 4：执行 MCP 能力
    console.log('🚀 步骤 4：执行 MCP 能力...');
    const result = await executor.call(
      {
        capabilityId: 11,
        agentBResponse,
        businessData,
      },
      capability.agentResponseSpec as any
    );

    console.log('✅ 步骤 4 完成：MCP 执行完成');
    console.log('📥 MCP 执行结果:', JSON.stringify(result, null, 2));

    // 返回测试结果
    return NextResponse.json({
      success: true,
      data: {
        testScenario,
        testParams: {
          accountName: testAccountName,
          agent: testAgent,
        },
        capability: {
          id: capability.id,
          capabilityType: capability.capabilityType,
          functionDesc: capability.functionDesc,
        },
        agentBResponse,
        mcpExecutionResult: result,
      },
      message: 'MCP 微信公众号-添加草稿测试完成',
    });
  } catch (error) {
    console.error('❌ 测试 MCP 微信公众号-添加草稿失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
