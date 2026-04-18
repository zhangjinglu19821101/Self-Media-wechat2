/**
 * 数据库迁移：创建 user_api_keys 表
 * 用于 BYOK（Bring Your Own Key）模式，存储用户自己的 LLM API Key
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    console.log('[Migration] 开始创建 user_api_keys 表...');

    // 1. 创建表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL,
        provider TEXT NOT NULL DEFAULT 'doubao',
        encrypted_key TEXT NOT NULL,
        key_iv TEXT NOT NULL,
        key_tag TEXT NOT NULL,
        key_suffix TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        last_verified_at TIMESTAMP,
        last_verify_error TEXT,
        display_name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('[Migration] user_api_keys 表已创建');

    // 2. 创建索引
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_user_api_keys_workspace_id
      ON user_api_keys (workspace_id)
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_user_api_keys_workspace_status
      ON user_api_keys (workspace_id, status)
    `);
    console.log('[Migration] 索引已创建');

    return NextResponse.json({
      success: true,
      message: 'user_api_keys 表迁移完成',
      details: {
        tableCreated: true,
        indexesCreated: 2,
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
