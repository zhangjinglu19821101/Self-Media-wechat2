/**
 * 迁移案例库：
 * 1. 将现有案例的 workspace_id 改为 'system'（系统预置）
 * 2. 添加可见性说明
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  try {
    const results: string[] = [];
    
    // Step 1: 将现有案例标记为系统预置
    const updateResult = await db.execute(sql`
      UPDATE industry_case_library 
      SET workspace_id = 'system' 
      WHERE workspace_id IS NULL OR workspace_id != 'system'
    `);
    const updatedCount = Array.isArray(updateResult) ? updateResult.length : (updateResult as any).rowCount || 0;
    results.push(`✓ 已将 ${updatedCount} 条案例标记为系统预置`);
    
    // Step 2: 统计
    const statsResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE workspace_id = 'system') as system_count,
        COUNT(*) FILTER (WHERE workspace_id != 'system') as user_count,
        COUNT(DISTINCT workspace_id) as workspace_count
      FROM industry_case_library
    `);
    const stats = Array.isArray(statsResult) ? statsResult[0] : (statsResult as any).rows?.[0];
    
    return NextResponse.json({
      success: true,
      results,
      message: '案例库迁移完成，现在支持系统案例与用户自定义案例的可见性隔离',
      visibilityRule: {
        system: 'workspace_id = "system" → 所有用户可见',
        user: 'workspace_id = 用户ID → 仅该用户可见'
      },
      stats: {
        total: Number(stats?.total || 0),
        systemCount: Number(stats?.system_count || 0),
        userCount: Number(stats?.user_count || 0),
        workspaceCount: Number(stats?.workspace_count || 0)
      }
    });
    
  } catch (error: any) {
    console.error('[Migration] 案例库迁移失败:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
