/**
 * 数据库迁移 API：为 article_content 表添加 sub_task_id 字段
 * 用于多平台发布功能：区分同一任务不同平台版本的文章
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    console.log('[DB迁移] 开始为 article_content 表添加 sub_task_id 字段...');

    // 1. 添加 sub_task_id 列
    await db.execute(sql`
      ALTER TABLE article_content 
      ADD COLUMN IF NOT EXISTS sub_task_id TEXT
    `);
    console.log('[DB迁移] ✅ sub_task_id 列已添加');

    // 2. 创建索引
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_article_content_sub_task_id 
      ON article_content(sub_task_id)
    `);
    console.log('[DB迁移] ✅ idx_article_content_sub_task_id 索引已创建');

    return NextResponse.json({
      success: true,
      message: 'article_content 表已成功添加 sub_task_id 字段和索引',
      migration: 'add-article-content-sub-task-id',
    });
  } catch (error: any) {
    console.error('[DB迁移] 失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '迁移失败' },
      { status: 500 }
    );
  }
}
