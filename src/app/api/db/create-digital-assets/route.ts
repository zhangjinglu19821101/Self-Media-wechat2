/**
 * 数字资产表创建迁移
 * GET /api/db/create-digital-assets
 *
 * 创建 3 张表：
 * 1. core_anchor_assets   — 核心锚点资产
 * 2. style_assets         — 风格规则资产
 * 3. feedback_assets      — 反馈迭代资产
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  const createdTables: string[] = [];
  const createdIndexes: string[] = [];

  try {
    console.log('[CreateDigitalAssets] 开始创建数字资产表...');

    // ============================================================
    // 1. 核心锚点资产表
    // ============================================================
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS core_anchor_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- 来源关联
        source_task_id TEXT,

        -- 锚点内容
        anchor_type TEXT NOT NULL,
        raw_content TEXT NOT NULL,

        -- NLP 分析结果（预留）
        extracted_keywords JSONB DEFAULT '[]',

        -- 使用统计
        usage_count INTEGER NOT NULL DEFAULT 0,
        is_effective BOOLEAN NOT NULL DEFAULT true,

        -- 用户关联
        user_id TEXT,

        -- 时间戳
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    createdTables.push('core_anchor_assets');

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_core_anchor_source_task ON core_anchor_assets(source_task_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_core_anchor_type ON core_anchor_assets(anchor_type);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_core_anchor_user_id ON core_anchor_assets(user_id);`);
    createdIndexes.push('idx_core_anchor_source_task', 'idx_core_anchor_type', 'idx_core_anchor_user_id');
    console.log('[CreateDigitalAssets] core_anchor_assets 表创建成功');

    // ============================================================
    // 2. 风格规则资产表
    // ============================================================
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS style_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- 规则分类
        rule_type TEXT NOT NULL,
        rule_content TEXT NOT NULL,
        rule_category TEXT NOT NULL,

        -- 来源样本
        sample_extract TEXT,

        -- 置信度与优先级
        confidence NUMERIC(3,2) DEFAULT 0.50,
        priority INTEGER NOT NULL DEFAULT 2,

        -- 来源与状态
        source_type TEXT NOT NULL DEFAULT 'manual',
        is_active BOOLEAN NOT NULL DEFAULT true,

        -- 有效期
        validity_expires_at TIMESTAMP,

        -- 用户关联
        user_id TEXT,

        -- 时间戳
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    createdTables.push('style_assets');

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_style_rule_type ON style_assets(rule_type);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_style_rule_category ON style_assets(rule_category);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_style_active_priority ON style_assets(is_active, priority);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_style_source_type ON style_assets(source_type);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_style_user_id ON style_assets(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_style_validity ON style_assets(validity_expires_at);`);
    createdIndexes.push(
      'idx_style_rule_type', 'idx_style_rule_category', 'idx_style_active_priority',
      'idx_style_source_type', 'idx_style_user_id', 'idx_style_validity'
    );
    console.log('[CreateDigitalAssets] style_assets 表创建成功');

    // ============================================================
    // 3. 反馈迭代资产表
    // ============================================================
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS feedback_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- 文章关联
        source_article_id TEXT,

        -- 反馈原始信息
        feedback_type TEXT NOT NULL,
        feedback_raw TEXT NOT NULL,

        -- 自动提取结果
        extracted_rule_type TEXT,
        extracted_rule_content TEXT,

        -- 审核状态
        is_validated BOOLEAN NOT NULL DEFAULT false,
        validity_expires_at TIMESTAMP,

        -- 时间戳
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    createdTables.push('feedback_assets');

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_feedback_article_id ON feedback_assets(source_article_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback_assets(feedback_type);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_feedback_validated ON feedback_assets(is_validated);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_feedback_expires ON feedback_assets(validity_expires_at);`);
    createdIndexes.push('idx_feedback_article_id', 'idx_feedback_type', 'idx_feedback_validated', 'idx_feedback_expires');
    console.log('[CreateDigitalAssets] feedback_assets 表创建成功');

    return NextResponse.json({
      success: true,
      message: '数字资产表创建成功',
      tables: createdTables,
      indexes: createdIndexes,
    });
  } catch (error: any) {
    console.error('[CreateDigitalAssets] 创建失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack,
      partialTables: createdTables,
    }, { status: 500 });
  }
}
