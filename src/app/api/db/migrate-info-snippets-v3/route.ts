import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/db/migrate-info-snippets-v3
 * 信息速记表 V3 迁移 - 并列多标签重构
 * 
 * 变更内容：
 * 1. 新增 categories 字段（JSONB 数组）替代 category 和 secondary_categories
 * 2. 迁移现有数据：将 category + secondary_categories 合并为 categories 数组
 * 3. 创建 GIN 索引支持数组包含查询（@> 操作符）
 * 4. 保留旧字段以兼容过渡期（可选删除）
 */
export async function GET() {
  try {
    const results: string[] = [];

    // 1. 新增 categories 字段（JSONB 数组）
    await db.execute(sql`
      ALTER TABLE info_snippets 
      ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT '["quick_note"]'::jsonb
    `);
    results.push('✓ categories 字段已添加');

    // 2. 迁移现有数据：将 category + secondary_categories 合并为 categories
    // 逻辑：如果 categories 为空或默认值，则从旧字段迁移
    await db.execute(sql`
      UPDATE info_snippets 
      SET categories = (
        CASE 
          WHEN category IS NOT NULL AND category != '' THEN
            jsonb_build_array(category) || COALESCE(secondary_categories, '[]'::jsonb)
          ELSE
            '["quick_note"]'::jsonb
        END
      )
      WHERE categories IS NULL 
         OR categories = '[]'::jsonb 
         OR categories = '["quick_note"]'::jsonb
    `);
    results.push('✓ 现有数据已迁移到 categories 字段');

    // 3. 创建 GIN 索引支持数组包含查询
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_info_snippets_categories_gin 
      ON info_snippets USING GIN (categories)
    `);
    results.push('✓ categories GIN 索引已创建');

    // 4. 更新注释
    await db.execute(sql`
      COMMENT ON COLUMN info_snippets.categories IS '分类标签数组（并列多标签，无主次之分）。存储如 ["medical", "insurance"] 的 JSON 数组'
    `);
    results.push('✓ 字段注释已更新');

    // 5. 查询迁移结果统计
    const statsResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE categories IS NOT NULL AND jsonb_array_length(categories) > 0) as migrated,
        COUNT(*) FILTER (WHERE jsonb_array_length(categories) > 1) as multi_category
      FROM info_snippets
    `);
    
    // 处理查询结果
    const rows = statsResult as unknown as { total: string; migrated: string; multi_category: string }[];
    const stats = rows[0];

    return NextResponse.json({
      success: true,
      message: '信息速记表 V3 迁移完成（并列多标签重构）',
      results,
      stats: {
        total: Number(stats?.total || 0),
        migrated: Number(stats?.migrated || 0),
        multiCategory: Number(stats?.multi_category || 0),
      },
      note: '旧字段 category 和 secondary_categories 已保留，待确认无问题后可手动删除',
    });
  } catch (error: any) {
    console.error('[migrate-info-snippets-v3] 错误:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || '迁移失败' 
    }, { status: 500 });
  }
}
