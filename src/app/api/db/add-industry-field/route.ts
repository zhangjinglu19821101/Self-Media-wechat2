/**
 * 数据库迁移 API：为 material_library 表新增 industry 和 source_article_id 字段
 * 同时为 article_content 表新增 industry 字段
 *
 * 新增字段：
 * - material_library.industry: 行业标识（insurance_life / insurance_health / insurance_property / finance / general）
 * - material_library.source_article_id: 来源文章ID（关联 article_content.article_id）
 * - article_content.industry: 行业标识
 *
 * GET: 查看迁移状态
 * POST: 执行迁移
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    // 检查 material_library 字段是否已存在
    const mlResult = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'material_library' 
        AND column_name IN ('industry', 'source_article_id', 'scene_type', 'analysis_text')
      ORDER BY column_name
    `);

    // 检查 article_content 字段是否已存在
    const acResult = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'article_content' 
        AND column_name IN ('industry')
      ORDER BY column_name
    `);

    const mlColumns = mlResult.rows.map((r: any) => r.column_name);
    const acColumns = acResult.rows.map((r: any) => r.column_name);

    return NextResponse.json({
      success: true,
      status: {
        material_library: {
          industry: mlColumns.includes('industry') ? 'exists' : 'missing',
          source_article_id: mlColumns.includes('source_article_id') ? 'exists' : 'missing',
          scene_type: mlColumns.includes('scene_type') ? 'exists' : 'missing',
          analysis_text: mlColumns.includes('analysis_text') ? 'exists' : 'missing',
        },
        article_content: {
          industry: acColumns.includes('industry') ? 'exists' : 'missing',
        },
      },
    });
  } catch (error) {
    console.error('[add-industry-field] 检查失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '检查失败',
    }, { status: 500 });
  }
}

export async function POST() {
  try {
    console.log('[add-industry-field] 开始迁移...');

    // 1. material_library: 新增 industry 字段
    await db.execute(sql`
      ALTER TABLE material_library 
      ADD COLUMN IF NOT EXISTS industry TEXT
    `);
    console.log('[add-industry-field] material_library.industry 字段已添加');

    // 2. material_library: 新增 source_article_id 字段
    await db.execute(sql`
      ALTER TABLE material_library 
      ADD COLUMN IF NOT EXISTS source_article_id TEXT
    `);
    console.log('[add-industry-field] material_library.source_article_id 字段已添加');

    // 3. material_library: 新增 scene_type 字段
    await db.execute(sql`
      ALTER TABLE material_library 
      ADD COLUMN IF NOT EXISTS scene_type TEXT
    `);
    console.log('[add-industry-field] material_library.scene_type 字段已添加');

    // 4. material_library: 新增 analysis_text 字段
    await db.execute(sql`
      ALTER TABLE material_library 
      ADD COLUMN IF NOT EXISTS analysis_text TEXT
    `);
    console.log('[add-industry-field] material_library.analysis_text 字段已添加');

    // 5. article_content: 新增 industry 字段
    await db.execute(sql`
      ALTER TABLE article_content 
      ADD COLUMN IF NOT EXISTS industry TEXT
    `);
    console.log('[add-industry-field] article_content.industry 字段已添加');

    // 6. 创建索引
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_material_industry ON material_library(industry)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_material_source_article ON material_library(source_article_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_material_scene_type ON material_library(scene_type)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_article_content_industry ON article_content(industry)
    `);
    console.log('[add-industry-field] 索引已创建');

    // 7. 为已有的保险类素材自动填充行业标识
    await db.execute(sql`
      UPDATE material_library 
      SET industry = 'insurance_life'
      WHERE industry IS NULL 
        AND topic_tags ?| ARRAY['人寿', '寿险', '年金', '增额寿', '终身寿', '定期寿', '两全险', '万能险', '分红险']
    `);

    await db.execute(sql`
      UPDATE material_library 
      SET industry = 'insurance_health'
      WHERE industry IS NULL 
        AND topic_tags ?| ARRAY['重疾', '医疗', '百万医疗', '意外', '防癌', '惠民保', '特药', '健康']
    `);

    await db.execute(sql`
      UPDATE material_library 
      SET industry = 'insurance_property'
      WHERE industry IS NULL 
        AND topic_tags ?| ARRAY['车险', '财产', '家财', '责任险', '工程险']
    `);

    await db.execute(sql`
      UPDATE material_library 
      SET industry = 'finance'
      WHERE industry IS NULL 
        AND topic_tags ?| ARRAY['理财', '投资', '基金', '信托', '银行', '储蓄']
    `);

    // 剩余未标记的设为通用
    await db.execute(sql`
      UPDATE material_library 
      SET industry = 'general'
      WHERE industry IS NULL
    `);
    console.log('[add-industry-field] 已有素材行业标识已自动填充');

    return NextResponse.json({
      success: true,
      message: '迁移完成：material_library(industry/source_article_id/scene_type/analysis_text) + article_content(industry) 字段已添加，索引已创建，已有素材已自动标记行业',
    });
  } catch (error) {
    console.error('[add-industry-field] 迁移失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '迁移失败',
    }, { status: 500 });
  }
}
