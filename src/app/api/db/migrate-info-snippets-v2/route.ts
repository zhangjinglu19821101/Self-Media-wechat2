import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/db/migrate-info-snippets-v2
 * 信息速记表 V2 迁移 - 新增分类、摘要、关键词、合规等字段
 */
export async function GET() {
  try {
    const results: string[] = [];

    // 1. 新增 raw_content 字段
    await db.execute(sql`
      ALTER TABLE info_snippets 
      ADD COLUMN IF NOT EXISTS raw_content TEXT
    `);
    results.push('✓ raw_content 字段已添加');

    // 2. 新增 category 字段
    await db.execute(sql`
      ALTER TABLE info_snippets 
      ADD COLUMN IF NOT EXISTS category TEXT
    `);
    results.push('✓ category 字段已添加');

    // 3. 新增 summary 字段
    await db.execute(sql`
      ALTER TABLE info_snippets 
      ADD COLUMN IF NOT EXISTS summary TEXT
    `);
    results.push('✓ summary 字段已添加');

    // 4. 新增 keywords 字段
    await db.execute(sql`
      ALTER TABLE info_snippets 
      ADD COLUMN IF NOT EXISTS keywords TEXT
    `);
    results.push('✓ keywords 字段已添加');

    // 5. 新增 applicable_scenes 字段
    await db.execute(sql`
      ALTER TABLE info_snippets 
      ADD COLUMN IF NOT EXISTS applicable_scenes TEXT
    `);
    results.push('✓ applicable_scenes 字段已添加');

    // 6. 新增 compliance_warnings 字段 (JSONB)
    await db.execute(sql`
      ALTER TABLE info_snippets 
      ADD COLUMN IF NOT EXISTS compliance_warnings JSONB
    `);
    results.push('✓ compliance_warnings 字段已添加');

    // 7. 新增 compliance_level 字段
    await db.execute(sql`
      ALTER TABLE info_snippets 
      ADD COLUMN IF NOT EXISTS compliance_level TEXT
    `);
    results.push('✓ compliance_level 字段已添加');

    // 8. 新增 material_status 字段
    await db.execute(sql`
      ALTER TABLE info_snippets 
      ADD COLUMN IF NOT EXISTS material_status TEXT DEFAULT 'draft'
    `);
    results.push('✓ material_status 字段已添加');

    // 9. 新增 material_id 字段
    await db.execute(sql`
      ALTER TABLE info_snippets 
      ADD COLUMN IF NOT EXISTS material_id TEXT
    `);
    results.push('✓ material_id 字段已添加');

    // 10. 创建索引
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_info_snippets_category ON info_snippets(category)
    `);
    results.push('✓ category 索引已创建');

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_info_snippets_material_status ON info_snippets(material_status)
    `);
    results.push('✓ material_status 索引已创建');

    return NextResponse.json({
      success: true,
      message: '信息速记表 V2 迁移完成',
      results,
    });
  } catch (error: any) {
    console.error('[migrate-info-snippets-v2] 错误:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || '迁移失败' 
    }, { status: 500 });
  }
}
