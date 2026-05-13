import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

export async function GET() {
  try {
    const db = getDatabase();
    
    const sqls = [
      // 文章提取主记录
      `CREATE TABLE IF NOT EXISTS article_extractions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL,
        article_title TEXT NOT NULL,
        article_text TEXT NOT NULL,
        article_hash VARCHAR(64),
        article_type VARCHAR(50),
        core_theme TEXT,
        emotion_tone VARCHAR(50),
        target_audience TEXT,
        publish_platform VARCHAR(50),
        template_id UUID,
        total_assets_created INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_article_extractions_workspace ON article_extractions(workspace_id)`,
      `CREATE INDEX IF NOT EXISTS idx_article_extractions_hash ON article_extractions(article_hash)`,
      `CREATE INDEX IF NOT EXISTS idx_article_extractions_template ON article_extractions(template_id)`,
      
      // 层级提取结果
      `CREATE TABLE IF NOT EXISTS extraction_layers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL,
        extraction_id UUID NOT NULL REFERENCES article_extractions(id),
        layer_name VARCHAR(50) NOT NULL,
        layer_index INTEGER NOT NULL,
        extraction_data JSONB NOT NULL,
        confidence INTEGER,
        extraction_notes TEXT,
        assets_created INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_extraction_layers_extraction ON extraction_layers(extraction_id)`,
      `CREATE INDEX IF NOT EXISTS idx_extraction_layers_workspace ON extraction_layers(workspace_id)`,
      `CREATE INDEX IF NOT EXISTS idx_extraction_layers_name ON extraction_layers(layer_name)`,
      
      // 提取转化的数字资产
      `CREATE TABLE IF NOT EXISTS extraction_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL,
        extraction_id UUID NOT NULL REFERENCES article_extractions(id),
        layer_id UUID REFERENCES extraction_layers(id),
        layer_name VARCHAR(50) NOT NULL,
        dimension_name VARCHAR(100) NOT NULL,
        asset_type VARCHAR(50) NOT NULL,
        asset_name VARCHAR(200) NOT NULL,
        asset_content TEXT NOT NULL,
        asset_metadata JSONB,
        template_id UUID,
        source_article_title TEXT,
        reuse_count INTEGER DEFAULT 0,
        last_used_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_extraction_assets_workspace ON extraction_assets(workspace_id)`,
      `CREATE INDEX IF NOT EXISTS idx_extraction_assets_extraction ON extraction_assets(extraction_id)`,
      `CREATE INDEX IF NOT EXISTS idx_extraction_assets_type ON extraction_assets(asset_type)`,
      `CREATE INDEX IF NOT EXISTS idx_extraction_assets_layer ON extraction_assets(layer_name)`,
      `CREATE INDEX IF NOT EXISTS idx_extraction_assets_template ON extraction_assets(template_id)`,
      `CREATE INDEX IF NOT EXISTS idx_extraction_assets_active ON extraction_assets(is_active)`,
    ];
    
    const results: string[] = [];
    for (const sql of sqls) {
      try {
        await db.execute(sql);
        results.push('OK');
      } catch (e: any) {
        results.push(`SKIP: ${e.message?.substring(0, 80)}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: '文章全维度提取表创建完成',
      results: results.length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
