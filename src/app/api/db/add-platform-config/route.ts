/**
 * 数据库迁移：platform_accounts 表新增 platform_config JSONB 字段
 * 用于存储每个平台账号的专属配置（如小红书的卡片模式、公众号的段落风格等）
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    console.log('[Migration] 开始添加 platform_config 字段...');

    // 1. 添加 platform_config 字段（如果不存在）
    await db.execute(sql`
      ALTER TABLE platform_accounts
      ADD COLUMN IF NOT EXISTS platform_config JSONB DEFAULT '{}'::jsonb
    `);
    console.log('[Migration] platform_config 字段已添加');

    // 2. 创建 GIN 索引（用于 JSONB 查询优化）
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_platform_accounts_platform_config
      ON platform_accounts USING GIN (platform_config)
    `);
    console.log('[Migration] GIN 索引已创建');

    // 3. 更新现有记录的默认值
    const result = await db.execute(sql`
      UPDATE platform_accounts
      SET platform_config = '{}'::jsonb
      WHERE platform_config IS NULL
    `);
    const updatedRows = Array.isArray(result) ? result.length : 0;
    console.log('[Migration] 已更新现有记录:', updatedRows, '行');

    return NextResponse.json({
      success: true,
      message: 'platform_config 字段迁移完成',
      details: {
        columnAdded: true,
        indexCreated: true,
        rowsUpdated: updatedRows,
      },
    });
  } catch (error: any) {
    console.error('[Migration] 迁移失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
