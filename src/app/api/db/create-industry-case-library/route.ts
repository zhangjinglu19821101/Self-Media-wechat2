/**
 * 数据库迁移 API：创建行业案例库表
 * 
 * GET /api/db/create-industry-case-library
 * 
 * 创建表：
 * - industry_case_library：行业案例库表
 * - case_usage_log：案例使用记录表
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    console.log('[DB Migration] 开始创建行业案例库表...');

    // 创建 industry_case_library 表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS industry_case_library (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- 行业分类
        industry TEXT NOT NULL,
        case_type TEXT NOT NULL DEFAULT 'positive',
        
        -- 核心标识
        case_id TEXT NOT NULL,
        title TEXT NOT NULL,
        
        -- 结构化内容
        applicable_products JSONB DEFAULT '[]'::jsonb,
        event_full_story TEXT,
        protagonist TEXT,
        background TEXT NOT NULL,
        insurance_action TEXT,
        result TEXT NOT NULL,
        
        -- 适用信息
        applicable_scenarios JSONB DEFAULT '[]'::jsonb,
        
        -- 标签系统
        product_tags JSONB DEFAULT '[]'::jsonb,
        crowd_tags JSONB DEFAULT '[]'::jsonb,
        scene_tags JSONB DEFAULT '[]'::jsonb,
        emotion_tags JSONB DEFAULT '[]'::jsonb,
        
        -- 合规信息
        source_desc TEXT,
        source_url TEXT,
        compliance_note TEXT,
        
        -- 向量ID
        vector_id TEXT,
        
        -- 使用统计
        use_count INTEGER NOT NULL DEFAULT 0,
        last_used_at TIMESTAMP,
        effective_count INTEGER DEFAULT 0,
        ineffective_count INTEGER DEFAULT 0,
        
        -- 状态
        status TEXT NOT NULL DEFAULT 'active',
        workspace_id TEXT,
        
        -- 时间戳
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('[DB Migration] industry_case_library 表创建成功');

    // 创建索引
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_case_industry ON industry_case_library(industry)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_case_type ON industry_case_library(case_type)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_case_status ON industry_case_library(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_case_workspace_id ON industry_case_library(workspace_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_case_use_count ON industry_case_library(use_count)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_case_product_tags ON industry_case_library USING gin(product_tags)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_case_crowd_tags ON industry_case_library USING gin(crowd_tags)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_case_scene_tags ON industry_case_library USING gin(scene_tags)`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_case_case_id_unique ON industry_case_library(case_id)`);
    console.log('[DB Migration] industry_case_library 索引创建成功');

    // 创建 case_usage_log 表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS case_usage_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        case_id UUID NOT NULL REFERENCES industry_case_library(id) ON DELETE CASCADE,
        
        -- 使用信息
        task_id UUID,
        article_title TEXT,
        article_snippet TEXT,
        
        -- 效果反馈
        is_effective BOOLEAN,
        feedback_note TEXT,
        
        -- 时间戳
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('[DB Migration] case_usage_log 表创建成功');

    // 创建索引
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_case_usage_case_id ON case_usage_log(case_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_case_usage_task_id ON case_usage_log(task_id)`);
    console.log('[DB Migration] case_usage_log 索引创建成功');

    return NextResponse.json({
      success: true,
      message: '行业案例库表创建成功',
      tables: ['industry_case_library', 'case_usage_log'],
      indexes: [
        'idx_case_industry',
        'idx_case_type',
        'idx_case_status',
        'idx_case_workspace_id',
        'idx_case_use_count',
        'idx_case_product_tags',
        'idx_case_crowd_tags',
        'idx_case_scene_tags',
        'idx_case_usage_case_id',
        'idx_case_usage_task_id',
      ],
    });
  } catch (error) {
    console.error('[DB Migration] 创建行业案例库表失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    }, { status: 500 });
  }
}
