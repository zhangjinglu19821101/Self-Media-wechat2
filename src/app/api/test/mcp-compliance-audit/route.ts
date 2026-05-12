/**
 * MCP 微信公众号合规审核 测试 API
 *
 * POST /api/test/mcp-compliance-audit
 *
 * 功能：
 * 1. 模拟 Agent B 生成标准指令
 * 2. 调用 MCP 执行器执行微信公众号合规审核
 * 3. 支持两种审核模式：full（完整审核）和 simple（快速检查）
 *
 * 测试场景：
 * - 场景 1：完整审核（ID 20）- 有违规内容
 * - 场景 2：完整审核（ID 20）- 无违规内容
 * - 场景 3：快速检查（ID 21）- 有违规内容
 * - 场景 4：快速检查（ID 21）- 无违规内容
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
 * POST - 测试 MCP 微信公众号合规审核
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      testScenario = 1, // 测试场景：1-4
      capabilityId = 20, // 能力 ID：20（完整审核）或 21（快速检查）
      articleTitle,
      articleContent,
      auditMode = 'full',
    } = body;

    console.log('🧪 开始测试 MCP 微信公众号合规审核');
    console.log(`🎯 测试场景: ${testScenario}`);
    console.log(`🆔 能力 ID: ${capabilityId}`);

    // 根据测试场景设置参数
    let testArticleTitle = articleTitle;
    let testArticleContent = articleContent;
    let testAuditMode = auditMode;
    let testCapabilityId = capabilityId;

    switch (testScenario) {
      case 1:
        // 场景 1：完整审核（ID 20）- 有违规内容
        testCapabilityId = 20;
        testArticleTitle = '测试文章：这是最好的保险产品';
        testArticleContent = `# 这是最好的保险产品

本文将为您介绍一款最好的保险产品，绝对是您的最佳选择！

## 产品特点

1. **最好的保障**：提供最好的保障范围
2. **顶级服务**：顶级的客户服务体验
3. **100% 赔付**：承诺100%赔付，稳赚不赔
4. **零风险**：零风险投资，绝对安全

## 总结

这是市场上唯一的选择，绝对不会让您失望！`;
        testAuditMode = 'full';
        console.log('📋 场景 1：完整审核（ID 20）- 有违规内容');
        break;

      case 2:
        // 场景 2：完整审核（ID 20）- 无违规内容
        testCapabilityId = 20;
        testArticleTitle = '测试文章：如何选择适合的保险产品';
        testArticleContent = `# 如何选择适合的保险产品

本文将为您介绍如何选择适合的保险产品。

## 为什么需要保险？

保险是现代生活中重要的风险管理工具。

## 如何选择保险产品？

### 1. 了解自己的需求

首先要明确自己的保险需求。

### 2. 比较不同产品

在选择保险产品时，要比较保障范围、保费价格等。

## 总结

选择适合的保险产品需要综合考虑个人需求和产品特点。`;
        testAuditMode = 'full';
        console.log('📋 场景 2：完整审核（ID 20）- 无违规内容');
        break;

      case 3:
        // 场景 3：快速检查（ID 21）- 有违规内容
        testCapabilityId = 21;
        testArticleTitle = '测试文章：这是最好的保险产品';
        testArticleContent = `# 这是最好的保险产品

本文将为您介绍一款最好的保险产品，绝对是您的最佳选择！`;
        console.log('📋 场景 3：快速检查（ID 21）- 有违规内容');
        break;

      case 4:
        // 场景 4：快速检查（ID 21）- 无违规内容
        testCapabilityId = 21;
        testArticleTitle = '测试文章：如何选择适合的保险产品';
        testArticleContent = `# 如何选择适合的保险产品

本文将为您介绍如何选择适合的保险产品。`;
        console.log('📋 场景 4：快速检查（ID 21）- 无违规内容');
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
      articleTitle: testArticleTitle,
      articleContent: testArticleContent,
      auditMode: testAuditMode,
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
          capabilityId: testCapabilityId,
          articleTitle: testArticleTitle,
          articleContent: testArticleContent?.substring(0, 100) + '...',
          auditMode: testAuditMode,
        },
        capability: {
          id: capability.id,
          capabilityType: capability.capabilityType,
          functionDesc: capability.functionDesc,
        },
        agentBResponse,
        mcpExecutionResult: result,
      },
      message: 'MCP 微信公众号合规审核测试完成',
    });
  } catch (error) {
    console.error('❌ 测试 MCP 微信公众号合规审核失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
