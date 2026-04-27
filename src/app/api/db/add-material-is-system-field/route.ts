/**
 * 数据库迁移：为素材库添加 is_system 字段
 * 
 * 功能：
 * 1. 添加 is_system 字段（boolean，默认 false）
 * 2. 创建索引 idx_material_is_system
 * 3. 可选：将现有数据标记为系统预置数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const markExistingAsSystem = searchParams.get('markExistingAsSystem') === 'true';
    
    console.log('[Migration] 开始添加 is_system 字段...');
    
    const results: string[] = [];
    
    // Step 1: 检查字段是否已存在
    const checkField = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'material_library' 
      AND column_name = 'is_system'
    `);
    
    if (checkField && checkField.length > 0) {
      results.push('✓ is_system 字段已存在，跳过创建');
    } else {
      // Step 2: 添加 is_system 字段
      await db.execute(sql`
        ALTER TABLE material_library 
        ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT FALSE
      `);
      results.push('✓ 已添加 is_system 字段（默认 false）');
      
      // Step 3: 创建索引
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_material_is_system 
        ON material_library(is_system)
      `);
      results.push('✓ 已创建索引 idx_material_is_system');
    }
    
    // Step 4: 可选 - 将现有数据标记为系统预置数据
    if (markExistingAsSystem) {
      const updateResult = await db.execute(sql`
        UPDATE material_library 
        SET is_system = TRUE 
        WHERE is_system = FALSE
      `);
      const updatedCount = Array.isArray(updateResult) ? updateResult.length : (updateResult as any).rowCount || 0;
      results.push(`✓ 已将 ${updatedCount} 条素材标记为系统预置数据`);
    }
    
    // Step 5: 统计数据
    const statsResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_system = TRUE) as system_count,
        COUNT(*) FILTER (WHERE is_system = FALSE) as user_count,
        COUNT(DISTINCT workspace_id) as workspace_count
      FROM material_library
    `);
    const stats = Array.isArray(statsResult) ? statsResult[0] : (statsResult as any).rows?.[0];
    
    console.log('[Migration] 迁移完成:', results);
    
    return NextResponse.json({
      success: true,
      message: 'is_system 字段添加完成',
      results,
      stats: {
        total: Number(stats?.total || 0),
        systemCount: Number(stats?.system_count || 0),
        userCount: Number(stats?.user_count || 0),
        workspaceCount: Number(stats?.workspace_count || 0)
      }
    });
    
  } catch (error: any) {
    console.error('[Migration] 添加 is_system 字段失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
