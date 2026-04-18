/**
 * 微信公众号配置测试接口
 * 用于验证微信公众号配置是否正确加载
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getWechatConfig,
  getAgentAccounts,
  formatWechatConfigForAgent,
} from '@/lib/wechat-config';
import { AgentId } from '@/lib/agent-types';

/**
 * GET /api/wechat/test - 测试微信公众号配置
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const agentId = searchParams.get('agentId') as AgentId | null;

    // 获取完整的微信公众号配置
    const config = getWechatConfig();

    // 检查配置是否为空
    if (config.length === 0) {
      return NextResponse.json({
        success: false,
        error: '未检测到微信公众号配置',
        message: '请在 .env.local 文件中配置 WECHAT_OFFICIAL_ACCOUNTS_JSON 环境变量',
        instructions: '参考 .env.example 文件进行配置',
      });
    }

    // 如果指定了 Agent ID，返回该 Agent 可用的公众号
    if (agentId) {
      if (!['A', 'B', 'C', 'D', 'insurance-c', 'insurance-d'].includes(agentId)) {
        return NextResponse.json({
          success: false,
          error: '无效的 Agent ID',
          message: 'Agent ID 必须是 A、B、C、D、insurance-c 或 insurance-d',
        });
      }

      const agentAccounts = getAgentAccounts(agentId);
      const formattedConfig = formatWechatConfigForAgent(agentId);

      return NextResponse.json({
        success: true,
        agentId,
        accountCount: agentAccounts.length,
        accounts: agentAccounts,
        formattedConfig,
        message: `Agent ${agentId} 可使用 ${agentAccounts.length} 个微信公众号`,
      });
    }

    // 返回完整配置信息
    return NextResponse.json({
      success: true,
      message: '微信公众号配置加载成功',
      totalAccounts: config.length,
      config: config.map((account) => ({
        id: account.id,
        accountId: account.accountId,
        name: account.name,
        appId: account.appId,
        agents: account.agents,
        permissions: account.permissions,
        // 不返回敏感信息 appSecret
      })),
      summary: {
        agentD: config.filter((acc) => acc.agents.includes('D')).length,
        agentInsuranceD: config.filter((acc) =>
          acc.agents.includes('insurance-d')
        ).length,
      },
    });
  } catch (error) {
    console.error('测试微信公众号配置失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '测试微信公众号配置失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
