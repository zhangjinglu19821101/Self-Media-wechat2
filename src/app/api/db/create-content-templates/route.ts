import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * 创建内容模板表（迁移）
 *
 * POST /api/db/create-content-templates
 */
export async function POST() {
  try {
    // 检查表是否已存在
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'content_templates'
      )
    `);

    const rows = tableExists as any[];
    if (rows?.[0]?.exists) {
      return NextResponse.json({
        success: true,
        message: 'content_templates 表已存在',
        alreadyExists: true,
      });
    }

    // 创建表
    await db.execute(sql`
      CREATE TABLE content_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        style_template_id UUID,
        platform TEXT NOT NULL DEFAULT 'xiaohongshu',
        card_count_mode TEXT NOT NULL DEFAULT '5-card',
        density_style TEXT NOT NULL DEFAULT 'standard',
        details JSONB NOT NULL,
        prompt_instruction TEXT NOT NULL,
        source_type TEXT NOT NULL DEFAULT 'uploaded_note',
        source_image_hashes JSONB DEFAULT '[]',
        use_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 创建索引
    await db.execute(sql`
      CREATE INDEX idx_content_templates_workspace ON content_templates(workspace_id)
    `);
    await db.execute(sql`
      CREATE INDEX idx_content_templates_platform ON content_templates(platform)
    `);
    await db.execute(sql`
      CREATE INDEX idx_content_templates_active ON content_templates(is_active, use_count DESC)
    `);
    await db.execute(sql`
      CREATE INDEX idx_content_templates_style ON content_templates(style_template_id)
    `);

    console.log('[Migration] ✅ content_templates 表创建成功');

    return NextResponse.json({
      success: true,
      message: 'content_templates 表创建成功',
      tableCreated: true,
    });
  } catch (error) {
    console.error('[Migration] ❌ 创建 content_templates 表失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
