import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/db/create-snippet-hashes-table
 * 创建信息速记哈希表（用于去重检测）
 */
export async function GET() {
  try {
    console.log('[create-snippet-hashes-table] 开始创建表...');

    // 创建 snippet_hashes 表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS snippet_hashes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        snippet_id UUID,
        workspace_id TEXT,
        sha256 TEXT NOT NULL,
        normalized_sha256 TEXT NOT NULL,
        sim_hash TEXT NOT NULL,
        content_length TEXT NOT NULL,
        content_preview TEXT,
        cached_analysis JSONB,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      );
    `);

    // 创建索引
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_snippet_hashes_sha256 ON snippet_hashes(sha256);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_snippet_hashes_normalized_sha256 ON snippet_hashes(normalized_sha256);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_snippet_hashes_workspace_id ON snippet_hashes(workspace_id);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_snippet_hashes_snippet_id ON snippet_hashes(snippet_id);
    `);

    console.log('[create-snippet-hashes-table] 表创建成功');

    return NextResponse.json({
      success: true,
      message: 'snippet_hashes 表创建成功',
      table: 'snippet_hashes',
      indexes: [
        'idx_snippet_hashes_sha256',
        'idx_snippet_hashes_normalized_sha256',
        'idx_snippet_hashes_workspace_id',
        'idx_snippet_hashes_snippet_id',
      ],
    });
  } catch (error: any) {
    console.error('[create-snippet-hashes-table] 创建失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
