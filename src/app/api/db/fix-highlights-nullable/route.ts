import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/db/fix-highlights-nullable
 * 修复 info_snippets 表 highlights 字段约束
 * 
 * 问题：原始表结构中 highlights 字段设置了 NOT NULL 约束，
 * 但当前 Schema 和业务逻辑未使用此字段，导致插入失败。
 * 
 * 解决：将 highlights 字段改为 nullable
 */
export async function GET() {
  try {
    const results: string[] = [];

    // 1. 检查 highlights 列是否存在
    const checkColumn = await db.execute(sql`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'info_snippets' AND column_name = 'highlights'
    `);
    
    const rows = checkColumn as unknown as { column_name: string; is_nullable: string }[];
    
    if (rows.length === 0) {
      results.push('✓ highlights 列不存在，无需修改');
      return NextResponse.json({
        success: true,
        message: 'highlights 列不存在，无需修改',
        results,
      });
    }

    // 2. 修改为 nullable
    await db.execute(sql`
      ALTER TABLE info_snippets 
      ALTER COLUMN highlights DROP NOT NULL
    `);
    results.push('✓ highlights 字段已改为 nullable');

    // 3. 设置默认值为空字符串（可选，保持数据一致性）
    await db.execute(sql`
      UPDATE info_snippets 
      SET highlights = '' 
      WHERE highlights IS NULL
    `);
    results.push('✓ 已将现有 NULL 值更新为空字符串');

    return NextResponse.json({
      success: true,
      message: 'highlights 字段约束修复完成',
      results,
    });
  } catch (error: any) {
    console.error('[fix-highlights-nullable] 错误:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || '修复失败' 
    }, { status: 500 });
  }
}
