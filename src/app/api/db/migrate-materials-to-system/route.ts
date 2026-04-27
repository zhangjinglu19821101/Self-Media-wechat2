/**
 * 迁移素材库：
 * 1. 删除 is_system 字段
 * 2. 将现有素材的 workspace_id 改为 'system'（系统预置）
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
    
    // Step 1: 删除 is_system 字段（如果存在）
    const checkField = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'material_library' 
      AND column_name = 'is_system'
    `);
    
    if (checkField && checkField.length > 0) {
      await db.execute(sql`ALTER TABLE material_library DROP COLUMN is_system`);
      results.push('✓ 已删除 is_system 字段');
    } else {
      results.push('✓ is_system 字段不存在，跳过');
    }
    
    // Step 2: 将现有素材标记为系统预置
    const updateResult = await db.execute(sql`
      UPDATE material_library 
      SET workspace_id = 'system' 
      WHERE workspace_id != 'system'
    `);
    const updatedCount = Array.isArray(updateResult) ? updateResult.length : (updateResult as any).rowCount || 0;
    results.push(`✓ 已将 ${updatedCount} 条素材标记为系统预置`);
    
    // Step 3: 统计
    const statsResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE workspace_id = 'system') as system_count,
        COUNT(*) FILTER (WHERE workspace_id != 'system') as user_count,
        COUNT(DISTINCT workspace_id) as workspace_count
      FROM material_library
    `);
    const stats = Array.isArray(statsResult) ? statsResult[0] : (statsResult as any).rows?.[0];
    
    return NextResponse.json({
      success: true,
      results,
      stats: {
        total: Number(stats?.total || 0),
        systemCount: Number(stats?.system_count || 0),
        userCount: Number(stats?.user_count || 0),
        workspaceCount: Number(stats?.workspace_count || 0)
      }
    });
    
  } catch (error: any) {
    console.error('[Migration] 迁移失败:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
