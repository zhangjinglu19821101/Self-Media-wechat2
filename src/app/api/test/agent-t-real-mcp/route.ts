/**
 * Agent T 真实 MCP 调用测试 API
 *
 * 目标：真实执行 MCP 调用，输出真实日志
 */

import { NextRequest, NextResponse } from 'next/server';
import { genericMCPCall } from '@/lib/mcp/generic-mcp-call';
import { toolRegistry } from '@/lib/mcp/tool-registry';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'test';

  // 收集执行日志，便于验证
  const executionLogs: string[] = [];
  
  const log = (message: string) => {
    console.log(message);
    executionLogs.push(message);
  };

  log('[Test API] Agent T 真实 MCP 调用测试开始');
  log('[Test API] Action: ' + action);

  try {
    if (action === 'list-tools') {
      // 列出所有已注册的工具
      const tools = toolRegistry.getAvailableTools();
      const toolInfos = toolRegistry.getToolInfos();

      log('[Test API] 已注册工具: ' + JSON.stringify(tools));

      return NextResponse.json({
        success: true,
        action: 'list-tools',
        tools,
        toolInfos: toolInfos.map(t => ({
          name: t.name,
          description: t.description,
          methods: Object.keys(t.instance || {}).filter(k => typeof (t.instance as any)[k] === 'function')
        })),
        executionLogs
      });
    }

    if (action === 'test-compliance') {
      // 真实测试微信公众号合规审核
      log('[Test API] ========== 开始真实测试微信公众号合规审核 ==========');

      // 步骤1：检查工具是否已注册
      log('[Test API] 步骤1：检查工具是否已注册');
      const hasTool = toolRegistry.hasTool('wechat_compliance');
      log('[Test API] wechat_compliance 工具是否已注册: ' + hasTool);

      if (!hasTool) {
        log('[Test API] ⚠️ wechat_compliance 工具未注册，尝试手动注册');

        // 尝试手动注册
        try {
          const { WechatComplianceAuditor } = await import('@/lib/mcp/wechat-compliance-auditor');
          toolRegistry.registerTool(
            'wechat_compliance',
            WechatComplianceAuditor,
            '微信公众号合规审核工具（手动注册）'
          );
          log('[Test API] ✅ wechat_compliance 工具手动注册成功');
        } catch (e) {
          log('[Test API] ❌ 手动注册失败: ' + e);
          return NextResponse.json({
            success: false,
            error: 'wechat_compliance 工具未注册且无法手动注册',
            availableTools: toolRegistry.getAvailableTools(),
            executionLogs
          }, { status: 400 });
        }
      }

      // 步骤2：显示工具信息
      log('[Test API] 步骤2：显示工具信息');
      const tool = toolRegistry.getTool('wechat_compliance');
      log('[Test API] 工具实例: ' + (tool ? '✅ 存在' : '❌ 不存在'));
      if (tool) {
        const methods = Object.keys(tool).filter(k => typeof (tool as any)[k] === 'function');
        log('[Test API] 工具方法: ' + JSON.stringify(methods));
      }

      // 步骤3：构建测试参数
      log('[Test API] 步骤3：构建测试参数');
      const testParams = {
        articles: [
          {
            title: '2024年保险产品购买指南',
            author: '保险助手',
            digest: '本文介绍2024年最新保险产品',
            content: '这是一篇关于保险产品的文章，介绍了最好的保险产品，提供100%保本保息的承诺，让您投保无忧！',
            show_cover_pic: 0
          }
        ],
        accountId: 'insurance-account'
      };
      log('[Test API] 测试参数: ' + JSON.stringify(testParams, null, 2));

      // 步骤4：真实调用 MCP
      log('[Test API] 步骤4：真实调用 MCP');
      log('[Test API] 调用 genericMCPCall...');

      const startTime = Date.now();
      const mcpResult = await genericMCPCall(
        'wechat_compliance',
        'content_audit',
        testParams
      );
      const endTime = Date.now();

      log('[Test API] MCP 调用完成，耗时: ' + (endTime - startTime) + 'ms');
      log('[Test API] MCP 调用结果: ' + JSON.stringify(mcpResult, null, 2));

      log('[Test API] ========== 真实测试完成 ==========');

      return NextResponse.json({
        success: true,
        action: 'test-compliance',
        timing: {
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          durationMs: endTime - startTime
        },
        input: {
          toolName: 'wechat_compliance',
          actionName: 'content_audit',
          params: testParams
        },
        output: mcpResult,
        executionLogs,
        verification: {
          isRealTest: true,
          hasMockFlag: !!(mcpResult as any)?._isMock,
          hasRealTimestamp: !!(mcpResult as any)?.data?.auditTime,
          hasRealMetadata: !!(mcpResult as any)?.metadata?.timestamp
        }
      });
    }

    // 默认：显示帮助
    return NextResponse.json({
      success: true,
      message: 'Agent T 真实 MCP 调用测试 API',
      availableActions: [
        {
          action: 'list-tools',
          description: '列出所有已注册的工具'
        },
        {
          action: 'test-compliance',
          description: '真实测试微信公众号合规审核'
        }
      ],
      examples: [
        '/api/test/agent-t-real-mcp?action=list-tools',
        '/api/test/agent-t-real-mcp?action=test-compliance'
      ]
    });

  } catch (error) {
    console.error('[Test API] 测试失败:', error);
    return NextResponse.json({
      success: false,
      error: '测试执行失败',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
