/**
 * 临时 API：更新微信合规审核能力的 agent_response_spec
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { capabilityList } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    // ID 20: content_audit - 完整合规审核
    const fullAuditSpec = {
      trigger_key: "call_mcp_meth_status",
      trigger_value: "true",
      required_params: [
        {
          param_name: "articleTitle",
          param_type: "string",
          example_value: "测试文章标题",
          desc: "文章标题"
        },
        {
          param_name: "articleContent",
          param_type: "string",
          example_value: "这是一篇测试文章内容",
          desc: "文章内容（HTML格式或纯文本"
        },
        {
          param_name: "auditMode",
          param_type: "string",
          example_value: "full",
          desc: "审核模式（full=完整审核，simple=快速检查）",
          optional: true
        }
      ],
      response_example: {
        call_mcp_meth_status: "true",
        articleTitle: "测试文章标题",
        articleContent: "这是一篇测试文章内容",
        auditMode: "full"
      },
      constraints: [
        "trigger_value 必须是字符串类型，不能用布尔 true/false",
        "必须返回 articleTitle 和 articleContent 参数",
        "auditMode 可选，不传默认为 full",
        "不允许携带任何敏感信息，如 appid、secret 等"
      ]
    };

    // ID 21: content_audit_simple - 快速合规检查
    const simpleAuditSpec = {
      trigger_key: "call_mcp_meth_status",
      trigger_value: "true",
      required_params: [
        {
          param_name: "articleContent",
          param_type: "string",
          example_value: "这是一篇测试文章内容",
          desc: "文章内容（HTML格式或纯文本"
        }
      ],
      response_example: {
        call_mcp_meth_status: "true",
        articleContent: "这是一篇测试文章内容"
      },
      constraints: [
        "trigger_value 必须是字符串类型，不能用布尔 true/false",
        "必须返回 articleContent 参数",
        "不允许携带任何敏感信息，如 appid、secret 等"
      ]
    };

    // 更新 ID 20
    await db.update(capabilityList)
      .set({ agentResponseSpec: fullAuditSpec })
      .where(eq(capabilityList.id, 20));

    // 更新 ID 21
    await db.update(capabilityList)
      .set({ agentResponseSpec: simpleAuditSpec })
      .where(eq(capabilityList.id, 21));

    return NextResponse.json({
      success: true,
      data: {
        fullAuditSpec,
        simpleAuditSpec
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
