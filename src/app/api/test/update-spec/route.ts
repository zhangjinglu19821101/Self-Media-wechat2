/**
 * 临时 API：更新 agent_response_spec，支持多账号
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { capabilityList } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const spec = {
      trigger_key: "call_mcp_meth_status",
      trigger_value: "true",
      required_params: [
        {
          param_name: "accountName",
          param_type: "string",
          example_value: "insurance-account",
          desc: "公众号名称（可选，不传则使用 agent 对应的默认账号）",
          optional: true
        },
        {
          param_name: "agent",
          param_type: "string",
          example_value: "insurance-d",
          desc: "Agent 类型（insurance-d / agent-d，可选，不传则列出所有可用账号）",
          optional: true
        },
        {
          param_name: "title",
          param_type: "string",
          example_value: "测试文章标题",
          desc: "文章标题"
        },
        {
          param_name: "content",
          param_type: "string",
          example_value: "这是一篇测试文章内容",
          desc: "文章内容（HTML格式或纯文本）"
        }
      ],
      response_example: {
        call_mcp_meth_status: "true",
        accountName: "insurance-account",
        agent: "insurance-d",
        title: "测试文章标题",
        content: "这是一篇测试文章内容"
      },
      constraints: [
        "trigger_value 必须是字符串类型，不能用布尔 true/false",
        "必须返回 title 和 content 参数",
        "accountName 和 agent 至少传一个，都不传则返回可用账号列表",
        "不允许携带任何敏感信息，如 appid、secret 等"
      ]
    };

    await db.update(capabilityList)
      .set({ agentResponseSpec: spec })
      .where(eq(capabilityList.id, 11));

    return NextResponse.json({ success: true, spec });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
