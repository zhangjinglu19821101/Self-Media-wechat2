/**
 * 素材标签统计 API
 * GET - 获取所有标签及其使用频率
 * 
 * 安全性：使用 Drizzle sql 模板标签参数化查询，避免 SQL 注入
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { getWorkspaceId } from '@/lib/auth/context';
import { SYSTEM_WORKSPACE_ID } from '@/lib/db/schema/material-library';

/**
 * GET /api/materials/tags
 * 获取标签统计
 * 
 * Query Parameters:
 * - type: 标签类型 (topic/scene/emotion)
 * - materialType: 素材类型筛选
 */
export async function GET(request: NextRequest) {
  try {
    const workspaceId = await getWorkspaceId(request);
    const { searchParams } = new URL(request.url);
    const tagType = searchParams.get('type') || 'topic';
    const materialType = searchParams.get('materialType');

    // 确定要查询的标签字段（列名来自常量，非用户输入，安全）
    const tagColumnName = tagType === 'scene' ? 'scene_tags' :
                     tagType === 'emotion' ? 'emotion_tags' :
                     'topic_tags';

    // 使用 Drizzle sql 模板标签实现参数化查询
    // - tagColumnName 是内部常量（非用户输入），使用 sql.identifier 安全引用
    // - workspaceId / materialType 使用 ${} 参数化绑定
    // 可见性条件：系统素材 + 当前工作区的用户素材
    let query;
    if (materialType) {
      query = sql`
        SELECT tag, count(*) as count 
        FROM material_library, jsonb_array_elements_text(${sql.identifier(tagColumnName)}) as tag 
        WHERE status = 'active' 
          AND type = ${materialType} 
          AND (owner_type = 'system' OR workspace_id = ${workspaceId})
        GROUP BY tag 
        ORDER BY count DESC 
        LIMIT 50
      `;
    } else {
      query = sql`
        SELECT tag, count(*) as count 
        FROM material_library, jsonb_array_elements_text(${sql.identifier(tagColumnName)}) as tag 
        WHERE status = 'active' 
          AND (owner_type = 'system' OR workspace_id = ${workspaceId})
        GROUP BY tag 
        ORDER BY count DESC 
        LIMIT 50
      `;
    }

    const result = await db.execute(query);

    // 处理返回结果
    const rows = Array.isArray(result) ? result : (result as any).rows || [];

    return NextResponse.json({
      success: true,
      data: rows.map((row: any) => ({
        tag: row.tag,
        count: Number(row.count)
      }))
    });
  } catch (error: any) {
    console.error('[MaterialTagsAPI] GET error:', error);
    return NextResponse.json({
      success: false,
      error: '标签统计服务暂时不可用'
    }, { status: 500 });
  }
}
