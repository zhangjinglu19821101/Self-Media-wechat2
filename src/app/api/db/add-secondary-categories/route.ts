import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/db/add-secondary-categories
 * 为 info_snippets 表添加 secondary_categories 字段
 */
export async function GET() {
  try {
    console.log('[迁移] 开始添加 secondary_categories 字段...');

    // 检查字段是否已存在
    const checkResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'info_snippets' 
      AND column_name = 'secondary_categories'
    `);

    if (checkResult.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'secondary_categories 字段已存在，无需迁移',
        alreadyExists: true,
      });
    }

    // 添加字段
    await db.execute(sql`
      ALTER TABLE info_snippets 
      ADD COLUMN secondary_categories jsonb DEFAULT '[]'::jsonb
    `);

    // 更新现有数据（设置为空数组）
    await db.execute(sql`
      UPDATE info_snippets 
      SET secondary_categories = '[]'::jsonb 
      WHERE secondary_categories IS NULL
    `);

    console.log('[迁移] secondary_categories 字段添加成功');

    return NextResponse.json({
      success: true,
      message: 'secondary_categories 字段添加成功',
      alreadyExists: false,
    });
  } catch (error: any) {
    console.error('[迁移] 错误:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
