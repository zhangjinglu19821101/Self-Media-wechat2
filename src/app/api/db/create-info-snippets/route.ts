import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/db/create-info-snippets
 * 创建信息速记表（数据库迁移）
 */
export async function GET() {
  try {
    // 检查表是否已存在
    const checkResult = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'info_snippets'
      )
    `);
    
    const exists = (checkResult as any)?.rows?.[0]?.exists;
    
    if (exists) {
      return NextResponse.json({
        success: true,
        message: 'info_snippets 表已存在',
      });
    }

    // 创建表
    await db.execute(sql`
      CREATE TABLE info_snippets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        source_org TEXT NOT NULL,
        publish_date TEXT,
        url TEXT,
        highlights TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        user_id TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // 创建索引
    await db.execute(sql`CREATE INDEX idx_info_snippet_status ON info_snippets(status)`);
    await db.execute(sql`CREATE INDEX idx_info_snippet_user_id ON info_snippets(user_id)`);
    await db.execute(sql`CREATE INDEX idx_info_snippet_created_at ON info_snippets(created_at)`);

    return NextResponse.json({
      success: true,
      message: 'info_snippets 表创建成功',
      indexes: ['idx_info_snippet_status', 'idx_info_snippet_user_id', 'idx_info_snippet_created_at'],
    });
  } catch (error: any) {
    console.error('[create-info-snippets] 错误:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || '创建表失败' 
    }, { status: 500 });
  }
}
