import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/db/add-info-snippets-reminder-fields
 * 为 info_snippets 表添加提醒相关字段（数据库迁移）
 * 
 * 如果表不存在，创建完整表（包含提醒字段）
 * 如果表存在，添加缺失的提醒字段
 * 
 * 新增字段：
 * - snippet_type: TEXT NOT NULL DEFAULT 'memory' (memory | reminder)
 * - remind_at: TIMESTAMP (提醒时间)
 * - remind_status: TEXT NOT NULL DEFAULT 'pending' (pending | triggered | dismissed)
 * - reminded_at: TIMESTAMP (实际提醒时间)
 * 
 * 新增索引：
 * - idx_info_snippets_snippet_type
 * - idx_info_snippets_remind_at
 */
export async function GET() {
  try {
    const results: string[] = [];

    // 1. 检查表是否存在
    const checkTable = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'info_snippets'
      )
    `);
    
    const tableExists = (checkTable as any)?.rows?.[0]?.exists;

    if (!tableExists) {
      // 表不存在，创建完整表（包含提醒字段）
      await db.execute(sql`
        CREATE TABLE info_snippets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          source_org TEXT NOT NULL,
          publish_date TEXT,
          url TEXT,
          highlights TEXT NOT NULL,
          snippet_type TEXT NOT NULL DEFAULT 'memory',
          remind_at TIMESTAMP,
          remind_status TEXT NOT NULL DEFAULT 'pending',
          reminded_at TIMESTAMP,
          status TEXT NOT NULL DEFAULT 'pending',
          user_id TEXT,
          workspace_id TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      results.push('创建 info_snippets 表成功（包含提醒字段）');

      // 创建索引
      await db.execute(sql`CREATE INDEX idx_info_snippet_status ON info_snippets(status)`);
      await db.execute(sql`CREATE INDEX idx_info_snippet_user_id ON info_snippets(user_id)`);
      await db.execute(sql`CREATE INDEX idx_info_snippets_workspace_id ON info_snippets(workspace_id)`);
      await db.execute(sql`CREATE INDEX idx_info_snippet_created_at ON info_snippets(created_at)`);
      await db.execute(sql`CREATE INDEX idx_info_snippets_snippet_type ON info_snippets(snippet_type)`);
      await db.execute(sql`CREATE INDEX idx_info_snippets_remind_at ON info_snippets(remind_at)`);
      results.push('创建所有索引成功');

      return NextResponse.json({
        success: true,
        message: 'info_snippets 表创建成功（包含提醒字段）',
        results,
      });
    }

    // 表已存在，检查并添加缺失字段
    results.push('info_snippets 表已存在，检查并添加缺失字段');

    // 2. 检查并添加 snippet_type 字段
    const checkSnippetType = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'info_snippets' 
      AND column_name = 'snippet_type'
    `);
    
    if ((checkSnippetType as any)?.rows?.length === 0) {
      await db.execute(sql`
        ALTER TABLE info_snippets 
        ADD COLUMN snippet_type TEXT NOT NULL DEFAULT 'memory'
      `);
      results.push('添加 snippet_type 字段成功');
    } else {
      results.push('snippet_type 字段已存在，跳过');
    }

    // 3. 检查并添加 remind_at 字段
    const checkRemindAt = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'info_snippets' 
      AND column_name = 'remind_at'
    `);
    
    if ((checkRemindAt as any)?.rows?.length === 0) {
      await db.execute(sql`
        ALTER TABLE info_snippets 
        ADD COLUMN remind_at TIMESTAMP
      `);
      results.push('添加 remind_at 字段成功');
    } else {
      results.push('remind_at 字段已存在，跳过');
    }

    // 4. 检查并添加 remind_status 字段
    const checkRemindStatus = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'info_snippets' 
      AND column_name = 'remind_status'
    `);
    
    if ((checkRemindStatus as any)?.rows?.length === 0) {
      await db.execute(sql`
        ALTER TABLE info_snippets 
        ADD COLUMN remind_status TEXT NOT NULL DEFAULT 'pending'
      `);
      results.push('添加 remind_status 字段成功');
    } else {
      results.push('remind_status 字段已存在，跳过');
    }

    // 5. 检查并添加 reminded_at 字段
    const checkRemindedAt = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'info_snippets' 
      AND column_name = 'reminded_at'
    `);
    
    if ((checkRemindedAt as any)?.rows?.length === 0) {
      await db.execute(sql`
        ALTER TABLE info_snippets 
        ADD COLUMN reminded_at TIMESTAMP
      `);
      results.push('添加 reminded_at 字段成功');
    } else {
      results.push('reminded_at 字段已存在，跳过');
    }

    // 6. 创建索引（如果不存在）
    try {
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_info_snippets_snippet_type ON info_snippets(snippet_type)
      `);
      results.push('创建 idx_info_snippets_snippet_type 索引成功');
    } catch (e: any) {
      if (!e.message.includes('already exists')) {
        results.push(`创建 snippet_type 索引: ${e.message}`);
      }
    }

    try {
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_info_snippets_remind_at ON info_snippets(remind_at)
      `);
      results.push('创建 idx_info_snippets_remind_at 索引成功');
    } catch (e: any) {
      if (!e.message.includes('already exists')) {
        results.push(`创建 remind_at 索引: ${e.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'info_snippets 表提醒字段迁移完成',
      results,
    });
  } catch (error: any) {
    console.error('[add-info-snippets-reminder-fields] 错误:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || '迁移失败' 
    }, { status: 500 });
  }
}
