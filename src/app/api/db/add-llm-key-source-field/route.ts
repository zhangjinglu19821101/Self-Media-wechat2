/**
 * 数据库迁移 API：为 workspaces 表添加 llm_key_source 字段
 * 
 * 使用方式：GET /api/db/add-llm-key-source-field
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('[Migration] 开始为 workspaces 表添加 llm_key_source 字段...');

    // 1. 检查字段是否已存在
    const checkColumn = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'workspaces' 
      AND column_name = 'llm_key_source'
    `);

    if (checkColumn.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'llm_key_source 字段已存在，无需迁移',
        skipped: true,
      });
    }

    // 2. 添加 llm_key_source 字段（默认 platform_credits = 使用平台积分）
    await db.execute(sql`
      ALTER TABLE workspaces 
      ADD COLUMN llm_key_source TEXT NOT NULL DEFAULT 'platform_credits'
    `);

    console.log('[Migration] workspaces 表 llm_key_source 字段添加成功');

    return NextResponse.json({
      success: true,
      message: 'workspaces 表 llm_key_source 字段添加成功',
      changes: [
        '添加 llm_key_source 字段（默认值 platform_credits）',
      ],
    });

  } catch (error) {
    console.error('[Migration] 迁移失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
