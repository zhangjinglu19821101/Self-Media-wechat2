/**
 * 数据库迁移 API：添加结构选择字段
 * 
 * 为 agent_sub_tasks 表添加 structure_name 和 structure_detail 字段
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    console.log('🔵 [DB Migration] 开始添加结构选择字段...');

    // 检查字段是否已存在
    const checkResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'agent_sub_tasks' 
      AND column_name IN ('structure_name', 'structure_detail')
    `);

    const existingColumns = (checkResult.rows || []).map((row: any) => row.column_name);
    console.log('🔵 [DB Migration] 已存在的字段:', existingColumns);

    const results = [];

    // 添加 structure_name 字段
    if (!existingColumns.includes('structure_name')) {
      console.log('🔵 [DB Migration] 添加 structure_name 字段...');
      await db.execute(sql`
        ALTER TABLE agent_sub_tasks 
        ADD COLUMN structure_name TEXT
      `);
      results.push({ column: 'structure_name', status: 'added' });
    } else {
      results.push({ column: 'structure_name', status: 'already_exists' });
    }

    // 添加 structure_detail 字段
    if (!existingColumns.includes('structure_detail')) {
      console.log('🔵 [DB Migration] 添加 structure_detail 字段...');
      await db.execute(sql`
        ALTER TABLE agent_sub_tasks 
        ADD COLUMN structure_detail TEXT
      `);
      results.push({ column: 'structure_detail', status: 'added' });
    } else {
      results.push({ column: 'structure_detail', status: 'already_exists' });
    }

    return NextResponse.json({
      success: true,
      message: '结构选择字段迁移完成',
      results,
    });

  } catch (error: any) {
    console.error('🔴 [DB Migration] 迁移失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
