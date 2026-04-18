/**
 * 数据库迁移 API：为 style_templates 表添加 platform 字段
 * 
 * 使用方式：GET /api/db/add-template-platform
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('[Migration] 开始为 style_templates 表添加 platform 字段...');

    // 1. 检查字段是否已存在
    const checkColumn = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'style_templates' 
      AND column_name = 'platform'
    `);

    if (checkColumn.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'platform 字段已存在，无需迁移',
        skipped: true,
      });
    }

    // 2. 添加 platform 字段
    await db.execute(sql`
      ALTER TABLE style_templates 
      ADD COLUMN platform TEXT NOT NULL DEFAULT 'wechat_official'
    `);

    // 3. 创建索引（按平台筛选模板时使用）
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_style_templates_platform 
      ON style_templates(platform)
    `);

    // 4. 更新现有记录（如果没有设置平台，默认为微信公众号）
    await db.execute(sql`
      UPDATE style_templates 
      SET platform = 'wechat_official' 
      WHERE platform IS NULL OR platform = ''
    `);

    console.log('[Migration] style_templates 表 platform 字段添加成功');

    return NextResponse.json({
      success: true,
      message: 'style_templates 表 platform 字段添加成功',
      changes: [
        '添加 platform 字段（默认值 wechat_official）',
        '创建 idx_style_templates_platform 索引',
        '更新现有记录的 platform 为 wechat_official',
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
