/**
 * 创建发布记录表
 * 
 * GET /api/db/create-publish-records
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  const results: string[] = [];

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS publish_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id TEXT NOT NULL,
        created_by TEXT NOT NULL,
        sub_task_id TEXT,
        platform TEXT NOT NULL,
        account_id TEXT,
        title TEXT NOT NULL,
        content_preview TEXT,
        cover_image_url TEXT,
        tags TEXT[],
        adapted_content JSONB DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending',
        platform_article_id TEXT,
        platform_url TEXT,
        error_message TEXT,
        error_code TEXT,
        retry_count INTEGER DEFAULT 0,
        scheduled_at TIMESTAMPTZ,
        published_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    results.push('✅ publish_records 表已创建');

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_publish_records_workspace ON publish_records(workspace_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_publish_records_sub_task ON publish_records(sub_task_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_publish_records_status ON publish_records(status);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_publish_records_platform ON publish_records(platform);`);
    results.push('✅ publish_records 索引已创建');

    return NextResponse.json({
      success: true,
      message: '发布记录表创建完成',
      results,
    });
  } catch (error: any) {
    console.error('[create-publish-records] 建表失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      results,
    }, { status: 500 });
  }
}
