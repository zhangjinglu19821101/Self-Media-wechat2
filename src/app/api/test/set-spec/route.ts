/**
 * 临时 API：设置 agent_response_spec
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
          example_value: "智者足迹 - 探寻",
          desc: "公众号名称"
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
          desc: "文章内容（HTML格式或纯文本)"
        }
      ],
      response_example: {
        call_mcp_meth_status: "true",
        accountName: "智者足迹 - 探寻",
        title: "测试文章标题",
        content: "这是一篇测试文章内容"
      },
      constraints: [
        "trigger_value 必须是字符串类型，不能用布尔 true/false",
        "必须返回所有 required_params 中的参数，不可缺失",
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
