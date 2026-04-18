/**
 * 创建 article_hashes 表的迁移 API
 * GET /api/db/create-article-hashes
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('[Migration] 开始创建/更新 article_hashes 表...');
    
    // 创建 article_hashes 表（如果不存在）
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS article_hashes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT,
        article_title TEXT,
        sha256 TEXT NOT NULL,
        normalized_sha256 TEXT,
        sim_hash TEXT NOT NULL,
        content_length BIGINT NOT NULL,
        template_id UUID,
        cached_analysis JSONB,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL
      );
    `);
    
    // 🔥 新增：添加 normalized_sha256 列（如果不存在）
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'article_hashes' AND column_name = 'normalized_sha256'
        ) THEN
          ALTER TABLE article_hashes ADD COLUMN normalized_sha256 TEXT;
        END IF;
      END $$;
    `);
    
    // 🔥 修复：将 sim_hash 从 BIGINT 转换为 TEXT（避免溢出）
    await db.execute(sql`
      DO $$
      BEGIN
        -- 检查 sim_hash 是否为 BIGINT 类型
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'article_hashes' 
          AND column_name = 'sim_hash' 
          AND data_type = 'bigint'
        ) THEN
          -- 创建临时列
          ALTER TABLE article_hashes ADD COLUMN sim_hash_text TEXT;
          -- 复制数据
          UPDATE article_hashes SET sim_hash_text = sim_hash::TEXT;
          -- 删除旧列
          ALTER TABLE article_hashes DROP COLUMN sim_hash;
          -- 重命名新列
          ALTER TABLE article_hashes RENAME COLUMN sim_hash_text TO sim_hash;
        END IF;
      END $$;
    `);
    
    // 更新已有记录的 normalized_sha256
    await db.execute(sql`
      UPDATE article_hashes 
      SET normalized_sha256 = sha256 
      WHERE normalized_sha256 IS NULL;
    `);
    
    // 将 normalized_sha256 设为 NOT NULL
    await db.execute(sql`
      ALTER TABLE article_hashes ALTER COLUMN normalized_sha256 SET NOT NULL;
    `);
    
    // 创建索引
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_article_hashes_sha256 ON article_hashes(sha256);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_article_hashes_normalized_sha256 ON article_hashes(normalized_sha256);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_article_hashes_user_id ON article_hashes(user_id);
    `);
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_article_hashes_template_id ON article_hashes(template_id);
    `);
    
    console.log('[Migration] article_hashes 表创建/更新成功');
    
    return NextResponse.json({
      success: true,
      message: 'article_hashes 表创建/更新成功',
      table: 'article_hashes',
      indexes: [
        'idx_article_hashes_sha256', 
        'idx_article_hashes_normalized_sha256',
        'idx_article_hashes_user_id', 
        'idx_article_hashes_template_id'
      ],
      changes: [
        'normalized_sha256 列已添加',
        'sim_hash 类型已从 BIGINT 改为 TEXT（避免溢出）',
      ],
    });
  } catch (error) {
    console.error('[Migration] 创建 article_hashes 表失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
