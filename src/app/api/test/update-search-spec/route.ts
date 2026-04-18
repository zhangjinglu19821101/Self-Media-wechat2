
/**
 * 临时 API：更新搜索 capability 的 agent_response_spec
 *
 * POST /api/test/update-search-spec
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { capabilityList } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * ID 16: 联网搜索-网页搜索 (webSearch)
 */
const WEB_SEARCH_SPEC = {
  trigger_key: 'call_mcp_meth_status',
  trigger_value: 'true',
  required_params: [
    {
      param_name: 'query',
      param_type: 'string',
      description: '搜索关键词',
      example_value: '2025年保险市场趋势',
      optional: false,
    },
    {
      param_name: 'count',
      param_type: 'number',
      description: '返回结果数量（1-50）',
      example_value: 10,
      optional: true,
    },
  ],
};

/**
 * ID 17: 联网搜索-网页搜索带摘要 (webSearchWithSummary)
 */
const WEB_SEARCH_WITH_SUMMARY_SPEC = {
  trigger_key: 'call_mcp_meth_status',
  trigger_value: 'true',
  required_params: [
    {
      param_name: 'query',
      param_type: 'string',
      description: '搜索关键词',
      example_value: '2025年保险市场趋势',
      optional: false,
    },
    {
      param_name: 'count',
      param_type: 'number',
      description: '返回结果数量（1-50）',
      example_value: 10,
      optional: true,
    },
  ],
};

/**
 * ID 18: 联网搜索-图片搜索 (imageSearch)
 */
const IMAGE_SEARCH_SPEC = {
  trigger_key: 'call_mcp_meth_status',
  trigger_value: 'true',
  required_params: [
    {
      param_name: 'query',
      param_type: 'string',
      description: '搜索关键词',
      example_value: '保险产品宣传图',
      optional: false,
    },
    {
      param_name: 'count',
      param_type: 'number',
      description: '返回结果数量（1-50）',
      example_value: 10,
      optional: true,
    },
  ],
};

export async function POST() {
  console.log('[Update Search Spec] 开始更新搜索 capability 的 agent_response_spec...');

  try {
    // 更新 ID 16: 联网搜索-网页搜索
    console.log('[Update Search Spec] 更新 ID 16...');
    await db
      .update(capabilityList)
      .set({
        agentResponseSpec: WEB_SEARCH_SPEC,
        updatedAt: new Date(),
      })
      .where(eq(capabilityList.id, 16));

    // 更新 ID 17: 联网搜索-网页搜索带摘要
    console.log('[Update Search Spec] 更新 ID 17...');
    await db
      .update(capabilityList)
      .set({
        agentResponseSpec: WEB_SEARCH_WITH_SUMMARY_SPEC,
        updatedAt: new Date(),
      })
      .where(eq(capabilityList.id, 17));

    // 更新 ID 18: 联网搜索-图片搜索
    console.log('[Update Search Spec] 更新 ID 18...');
    await db
      .update(capabilityList)
      .set({
        agentResponseSpec: IMAGE_SEARCH_SPEC,
        updatedAt: new Date(),
      })
      .where(eq(capabilityList.id, 18));

    console.log('[Update Search Spec] 更新完成！');

    return NextResponse.json({
      success: true,
      message: '搜索 capability 的 agent_response_spec 更新成功',
      data: {
        updated: [16, 17, 18],
      },
    });
  } catch (error) {
    console.error('[Update Search Spec] 更新失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

