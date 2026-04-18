/**
 * Capability List API
 * 
 * 查询 MCP 能力清单
 * 支持按 capability_type 过滤
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { capabilityList } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { isValidCapabilityType } from '@/lib/types/capability-types';

export const maxDuration = 60;

/**
 * GET /api/capability-list
 * 
 * 查询能力清单
 * 
 * 查询参数:
 * - capability_type: 按能力类型过滤（可选）
 * - status: 按状态过滤（可选，默认 available）
 * 
 * 示例:
 * GET /api/capability-list?capability_type=platform_publish
 * GET /api/capability-list?status=available
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const capabilityType = searchParams.get('capability_type');
    const status = searchParams.get('status') || 'available';

    console.log('[Capability List API] 查询能力清单');
    if (capabilityType) {
      console.log('[Capability List API] 按能力类型过滤:', capabilityType);
    }
    console.log('[Capability List API] 状态:', status);

    // 验证 capability_type（如果提供）
    if (capabilityType && !isValidCapabilityType(capabilityType)) {
      return NextResponse.json(
        { success: false, error: `无效的 capability_type: ${capabilityType}` },
        { status: 400 }
      );
    }

    // 构建查询条件
    let query = db.select().from(capabilityList);
    
    const conditions = [];
    if (capabilityType) {
      conditions.push(eq(capabilityList.capabilityType, capabilityType));
    }
    if (status) {
      conditions.push(eq(capabilityList.status, status));
    }

    // 执行查询
    let results;
    if (conditions.length > 0) {
      // @ts-ignore - Drizzle ORM 类型处理
      results = await query.where(and(...conditions));
    } else {
      results = await query;
    }

    // 格式化返回结果（匹配文档中的格式）
    const formattedResults = results.map(item => ({
      id: item.id,
      function_desc: item.functionDesc,
      status: item.status,
      requires_on_site_execution: item.requiresOnSiteExecution,
      metadata: item.metadata,
    }));

    console.log('[Capability List API] 查询成功，返回', formattedResults.length, '条记录');

    return NextResponse.json({
      success: true,
      data: {
        capability_list: formattedResults,
      },
    });
  } catch (error) {
    console.error('[Capability List API] 查询失败:', error);
    return NextResponse.json(
      { success: false, error: `查询失败: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

// 导入缺失的 and 函数
import { and } from 'drizzle-orm';
