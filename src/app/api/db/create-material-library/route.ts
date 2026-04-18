/**
 * 素材库表创建迁移
 * GET /api/db/create-material-library
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('[CreateMaterialLibrary] 开始创建素材库表...');

    // 创建素材库主表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS material_library (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- 核心内容
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        
        -- 来源信息
        source_type TEXT NOT NULL DEFAULT 'manual',
        source_desc TEXT,
        source_url TEXT,
        
        -- 标签系统
        topic_tags JSONB DEFAULT '[]',
        scene_tags JSONB DEFAULT '[]',
        emotion_tags JSONB DEFAULT '[]',
        
        -- 适用信息
        applicable_positions JSONB DEFAULT '[]',
        
        -- 向量ID（预留）
        vector_id TEXT,
        
        -- 使用统计
        use_count INTEGER NOT NULL DEFAULT 0,
        last_used_at TIMESTAMP,
        
        -- 效果统计
        effective_count INTEGER DEFAULT 0,
        ineffective_count INTEGER DEFAULT 0,
        
        -- 状态
        status TEXT NOT NULL DEFAULT 'active',
        
        -- 用户关联
        user_id TEXT,
        
        -- 时间戳
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('[CreateMaterialLibrary] 素材库主表创建成功');

    // 创建索引
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_material_type ON material_library(type);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_material_status ON material_library(status);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_material_user_id ON material_library(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_material_use_count ON material_library(use_count DESC);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_material_topic_tags ON material_library USING GIN(topic_tags);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_material_scene_tags ON material_library USING GIN(scene_tags);`);
    console.log('[CreateMaterialLibrary] 索引创建成功');

    // 创建素材使用记录表
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS material_usage_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        material_id UUID NOT NULL REFERENCES material_library(id) ON DELETE CASCADE,
        
        -- 使用场景
        article_id TEXT,
        article_title TEXT,
        used_position TEXT,
        
        -- 使用效果
        effect_type TEXT,
        
        -- 时间戳
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('[CreateMaterialLibrary] 素材使用记录表创建成功');

    // 创建使用记录表索引
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_usage_material_id ON material_usage_log(material_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_usage_article_id ON material_usage_log(article_id);`);
    console.log('[CreateMaterialLibrary] 使用记录表索引创建成功');

    return NextResponse.json({
      success: true,
      message: '素材库表创建成功',
      tables: ['material_library', 'material_usage_log'],
      indexes: [
        'idx_material_type',
        'idx_material_status',
        'idx_material_user_id',
        'idx_material_use_count',
        'idx_material_topic_tags',
        'idx_material_scene_tags',
        'idx_usage_material_id',
        'idx_usage_article_id'
      ]
    });
  } catch (error: any) {
    console.error('[CreateMaterialLibrary] 创建失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
}
