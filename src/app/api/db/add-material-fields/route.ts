import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getDatabase } from '@/lib/db';

/**
 * 添加 material_library 表缺失字段
 * GET /api/db/add-material-fields
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDatabase();
    const results: string[] = [];

    // 检查并添加 industry 列
    const industryCheck = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = current_schema() 
      AND table_name = 'material_library' 
      AND column_name = 'industry'
    `);
    
    if (industryCheck.length === 0) {
      await db.execute(sql`ALTER TABLE material_library ADD COLUMN industry TEXT`);
      results.push('添加 industry 列');
    } else {
      results.push('industry 列已存在');
    }

    // 检查并添加 paradigm_id 列
    const paradigmIdCheck = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = current_schema() 
      AND table_name = 'material_library' 
      AND column_name = 'paradigm_id'
    `);
    
    if (paradigmIdCheck.length === 0) {
      await db.execute(sql`ALTER TABLE material_library ADD COLUMN paradigm_id TEXT`);
      results.push('添加 paradigm_id 列');
    } else {
      results.push('paradigm_id 列已存在');
    }

    // 检查并添加 paradigm_position 列
    const paradigmPositionCheck = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = current_schema() 
      AND table_name = 'material_library' 
      AND column_name = 'paradigm_position'
    `);
    
    if (paradigmPositionCheck.length === 0) {
      await db.execute(sql`ALTER TABLE material_library ADD COLUMN paradigm_position TEXT`);
      results.push('添加 paradigm_position 列');
    } else {
      results.push('paradigm_position 列已存在');
    }

    // 检查并添加 source_article_id 列
    const sourceArticleIdCheck = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = current_schema() 
      AND table_name = 'material_library' 
      AND column_name = 'source_article_id'
    `);
    
    if (sourceArticleIdCheck.length === 0) {
      await db.execute(sql`ALTER TABLE material_library ADD COLUMN source_article_id TEXT`);
      results.push('添加 source_article_id 列');
    } else {
      results.push('source_article_id 列已存在');
    }

    // 检查并添加 applicable_positions 列
    const applicablePositionsCheck = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = current_schema() 
      AND table_name = 'material_library' 
      AND column_name = 'applicable_positions'
    `);
    
    if (applicablePositionsCheck.length === 0) {
      await db.execute(sql`ALTER TABLE material_library ADD COLUMN applicable_positions JSONB DEFAULT '[]'::jsonb`);
      results.push('添加 applicable_positions 列');
    } else {
      results.push('applicable_positions 列已存在');
    }

    // 检查并添加 effective_count 列
    const effectiveCountCheck = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = current_schema() 
      AND table_name = 'material_library' 
      AND column_name = 'effective_count'
    `);
    
    if (effectiveCountCheck.length === 0) {
      await db.execute(sql`ALTER TABLE material_library ADD COLUMN effective_count INTEGER DEFAULT 0`);
      results.push('添加 effective_count 列');
    } else {
      results.push('effective_count 列已存在');
    }

    // 检查并添加 ineffective_count 列
    const ineffectiveCountCheck = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = current_schema() 
      AND table_name = 'material_library' 
      AND column_name = 'ineffective_count'
    `);
    
    if (ineffectiveCountCheck.length === 0) {
      await db.execute(sql`ALTER TABLE material_library ADD COLUMN ineffective_count INTEGER DEFAULT 0`);
      results.push('添加 ineffective_count 列');
    } else {
      results.push('ineffective_count 列已存在');
    }

    // 检查并添加 analysis_text 列
    const analysisTextCheck = await db.execute(sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = current_schema() 
      AND table_name = 'material_library' 
      AND column_name = 'analysis_text'
    `);
    
    if (analysisTextCheck.length === 0) {
      await db.execute(sql`ALTER TABLE material_library ADD COLUMN analysis_text TEXT`);
      results.push('添加 analysis_text 列');
    } else {
      results.push('analysis_text 列已存在');
    }

    // 创建索引
    const indexCheck = await db.execute(sql`
      SELECT indexname FROM pg_indexes 
      WHERE schemaname = current_schema() 
      AND tablename = 'material_library' 
      AND indexname = 'idx_material_industry'
    `);
    
    if (indexCheck.length === 0) {
      await db.execute(sql`CREATE INDEX idx_material_industry ON material_library(industry)`);
      results.push('创建 idx_material_industry 索引');
    } else {
      results.push('idx_material_industry 索引已存在');
    }

    return NextResponse.json({
      success: true,
      message: 'material_library 字段迁移完成',
      results
    });

  } catch (error) {
    console.error('迁移失败:', error);
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
}
