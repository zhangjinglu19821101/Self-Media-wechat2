import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

/**
 * 范式初始化状态表迁移 API
 * GET /api/db/create-paradigm-init-status
 * 
 * 创建 paradigm_init_status 表，并为已有提取记录回填范式初始化状态
 */
export async function GET() {
  try {
    const db = getDatabase();
    
    const sqls = [
      // 创建范式初始化状态表
      `CREATE TABLE IF NOT EXISTS paradigm_init_status (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL,
        paradigm_id VARCHAR(50) NOT NULL,
        paradigm_name VARCHAR(80) NOT NULL,
        is_initialized BOOLEAN NOT NULL DEFAULT FALSE,
        initialized_at TIMESTAMP,
        extraction_count INTEGER NOT NULL DEFAULT 0,
        total_material_count INTEGER NOT NULL DEFAULT 0,
        avg_match_score INTEGER DEFAULT 0,
        best_match_score INTEGER DEFAULT 0,
        last_extraction_id UUID,
        last_extraction_at TIMESTAMP,
        covered_dimensions JSONB DEFAULT '[]'::jsonb,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,
      
      // 唯一约束（同一workspace下同一paradigm_id只能有一条记录）
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_paradigm_init_workspace_paradigm ON paradigm_init_status(workspace_id, paradigm_id)`,
      
      // 索引
      `CREATE INDEX IF NOT EXISTS idx_paradigm_init_workspace ON paradigm_init_status(workspace_id)`,
      `CREATE INDEX IF NOT EXISTS idx_paradigm_init_paradigm ON paradigm_init_status(paradigm_id)`,
      
      // 从已有 article_extractions 回填范式初始化状态
      `INSERT INTO paradigm_init_status (workspace_id, paradigm_id, paradigm_name, is_initialized, initialized_at, extraction_count, total_material_count, avg_match_score, best_match_score, last_extraction_id, last_extraction_at, covered_dimensions)
       SELECT 
         ae.workspace_id,
         ae.paradigm_type,
         ae.paradigm_name,
         TRUE,
         MIN(ae.created_at),
         COUNT(*),
         COALESCE(SUM(COALESCE(jsonb_array_length(COALESCE(ae.relational_materials, '[]'::jsonb)), 0)), 0),
         COALESCE(AVG(ae.paradigm_match_score), 0)::INTEGER,
         COALESCE(MAX(ae.paradigm_match_score), 0),
         (SELECT id FROM article_extractions ae2 WHERE ae2.workspace_id = ae.workspace_id AND ae2.paradigm_type = ae.paradigm_type ORDER BY created_at DESC LIMIT 1),
         MAX(ae.created_at),
         '[]'::jsonb
       FROM article_extractions ae
       WHERE ae.paradigm_type IS NOT NULL AND ae.paradigm_type != ''
       GROUP BY ae.workspace_id, ae.paradigm_type, ae.paradigm_name
       ON CONFLICT (workspace_id, paradigm_id) DO NOTHING`,
    ];
    
    const results: string[] = [];
    for (const sql of sqls) {
      try {
        await db.execute(sql);
        results.push('OK');
      } catch (e: any) {
        results.push(`SKIP: ${e.message?.substring(0, 120)}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: '范式初始化状态表创建完成（含已有数据回填）',
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
