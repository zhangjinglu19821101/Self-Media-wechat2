/**
 * 数据库迁移：素材库归属类型升级
 * 
 * 1. material_library 表新增 owner_type 字段（默认 'user'）
 * 2. 创建 material_bookmarks 收藏表
 * 3. 回填现有数据的 owner_type
 * 4. 创建相关索引
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const results: { step: string; status: string; detail?: string }[] = [];

  try {
    // Step 1: 新增 owner_type 字段
    try {
      await db.execute(sql`
        ALTER TABLE material_library 
        ADD COLUMN IF NOT EXISTS owner_type VARCHAR(20) NOT NULL DEFAULT 'user'
      `);
      results.push({ step: '1. 新增 owner_type 字段', status: 'ok' });
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        results.push({ step: '1. 新增 owner_type 字段', status: 'skip', detail: '字段已存在' });
      } else {
        results.push({ step: '1. 新增 owner_type 字段', status: 'error', detail: e.message });
      }
    }

    // Step 2: 回填现有数据的 owner_type
    try {
      const updateResult = await db.execute(sql`
        UPDATE material_library 
        SET owner_type = 'user' 
        WHERE owner_type IS NULL OR owner_type = 'user'
      `);
      const rowsAffected = (updateResult as any)?.rowCount || 0;
      results.push({ step: '2. 回填 owner_type', status: 'ok', detail: `${rowsAffected} rows` });
    } catch (e: any) {
      results.push({ step: '2. 回填 owner_type', status: 'error', detail: e.message });
    }

    // Step 3: 创建索引
    try {
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_material_owner_type ON material_library(owner_type)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_material_owner_status ON material_library(owner_type, status)
      `);
      results.push({ step: '3. 创建归属索引', status: 'ok' });
    } catch (e: any) {
      results.push({ step: '3. 创建归属索引', status: 'error', detail: e.message });
    }

    // Step 4: 创建素材收藏表
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS material_bookmarks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          material_id UUID NOT NULL REFERENCES material_library(id) ON DELETE CASCADE,
          workspace_id TEXT NOT NULL,
          user_tags JSONB DEFAULT '[]',
          notes TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      results.push({ step: '4. 创建 material_bookmarks 表', status: 'ok' });
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        results.push({ step: '4. 创建 material_bookmarks 表', status: 'skip', detail: '表已存在' });
      } else {
        results.push({ step: '4. 创建 material_bookmarks 表', status: 'error', detail: e.message });
      }
    }

    // Step 5: 创建收藏表索引
    try {
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_bookmark_material_id ON material_bookmarks(material_id)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_bookmark_workspace_id ON material_bookmarks(workspace_id)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_bookmark_unique ON material_bookmarks(material_id, workspace_id)
      `);
      results.push({ step: '5. 创建收藏表索引', status: 'ok' });
    } catch (e: any) {
      results.push({ step: '5. 创建收藏表索引', status: 'error', detail: e.message });
    }

    // Step 6: 新增来源类型扩展
    try {
      // source_type 从 check constraint 释放（原无 constraint，无需操作）
      // 仅更新 source_type 列的注释
      await db.execute(sql`
        COMMENT ON COLUMN material_library.source_type IS '来源类型: manual/article/ai_generate/import/system_admin/system_crawl/info_snippet/web_search'
      `);
      results.push({ step: '6. 扩展来源类型注释', status: 'ok' });
    } catch (e: any) {
      results.push({ step: '6. 扩展来源类型注释', status: 'error', detail: e.message });
    }

    const hasError = results.some(r => r.status === 'error');
    return NextResponse.json({
      success: !hasError,
      results,
      message: hasError ? '迁移部分失败，请检查详情' : '迁移全部完成',
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      results,
      error: error.message,
    }, { status: 500 });
  }
}
