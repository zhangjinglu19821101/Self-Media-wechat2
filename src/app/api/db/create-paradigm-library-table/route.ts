import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

/**
 * 范式库表迁移 API
 * GET /api/db/create-paradigm-library-table
 * 
 * 创建 paradigm_library 和 paradigm_usage_stats 表
 * paradigm_library 存储10套创作范式的完整定义（结构、素材位置映射、情绪曲线等）
 */
export async function GET() {
  try {
    const db = getDatabase();
    
    const sqls = [
      // ==================== paradigm_library 主表 ====================
      `CREATE TABLE IF NOT EXISTS paradigm_library (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL,
        paradigm_code VARCHAR(50) NOT NULL,
        paradigm_name VARCHAR(100) NOT NULL,
        description TEXT,
        applicable_article_types JSONB NOT NULL DEFAULT '[]'::jsonb,
        applicable_industries JSONB DEFAULT '[]'::jsonb,
        applicable_scene_keywords JSONB DEFAULT '[]'::jsonb,
        official_account_structure JSONB NOT NULL DEFAULT '[]'::jsonb,
        xiaohongshu_structure JSONB NOT NULL DEFAULT '[]'::jsonb,
        material_position_map JSONB NOT NULL DEFAULT '[]'::jsonb,
        emotion_curve JSONB NOT NULL DEFAULT '[]'::jsonb,
        signature_phrases JSONB DEFAULT '[]'::jsonb,
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        is_system BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,

      // 唯一约束（同一workspace下paradigm_code唯一）
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_paradigm_library_workspace_code ON paradigm_library(workspace_id, paradigm_code)`,

      // 索引
      `CREATE INDEX IF NOT EXISTS idx_paradigm_library_workspace ON paradigm_library(workspace_id)`,
      `CREATE INDEX IF NOT EXISTS idx_paradigm_library_code ON paradigm_library(paradigm_code)`,
      `CREATE INDEX IF NOT EXISTS idx_paradigm_library_active ON paradigm_library(is_active)`,

      // ==================== paradigm_usage_stats 使用统计表 ====================
      `CREATE TABLE IF NOT EXISTS paradigm_usage_stats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL,
        paradigm_id UUID NOT NULL REFERENCES paradigm_library(id),
        usage_count INTEGER DEFAULT 0,
        last_used_at TIMESTAMP,
        avg_quality_score INTEGER,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,

      `CREATE INDEX IF NOT EXISTS idx_paradigm_usage_workspace ON paradigm_usage_stats(workspace_id)`,
      `CREATE INDEX IF NOT EXISTS idx_paradigm_usage_paradigm ON paradigm_usage_stats(paradigm_id)`,
    ];
    
    const results: string[] = [];
    for (const sql of sqls) {
      try {
        await db.execute(sql);
        results.push('OK');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push(`SKIP: ${msg.substring(0, 200)}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: '范式库表创建完成（paradigm_library + paradigm_usage_stats）',
      results,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
