/**
 * 素材标签统计 API
 * GET - 获取所有标签及其使用频率
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

    // 确定要查询的标签字段
    const tagColumnName = tagType === 'scene' ? 'scene_tags' :
                     tagType === 'emotion' ? 'emotion_tags' :
                     'topic_tags';

    // 使用jsonb_array_elements_text展开JSONB数组 + workspace 可见性（用户workspace OR 系统预置）
    // 参数化查询：workspaceId/materialType 使用参数绑定，tagColumnName 使用 sql.raw（字段名不可参数化）
    const conditions = [
      sql`status = 'active'`,
      sql`(workspace_id = ${workspaceId} OR workspace_id = ${SYSTEM_WORKSPACE_ID})`
    ];
    if (materialType) {
      conditions.push(sql`type = ${materialType}`);
    }

    const query = sql`
      SELECT tag, count(*) as count 
      FROM material_library, jsonb_array_elements_text(${sql.raw(tagColumnName)}) as tag 
      WHERE ${sql.join(conditions, sql` AND `)}
      GROUP BY tag 
      ORDER BY count DESC 
      LIMIT 50
    `;

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
      error: error.message
    }, { status: 500 });
  }
}
