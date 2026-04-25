/**
 * 补充 material_library JSONB GIN 索引迁移
 * GET /api/db/add-material-gin-index
 *
 * 为 topic_tags / scene_tags / emotion_tags 创建 GIN 索引
 * 支持 JSONB 数组的 @> 包含查询（recallByTags 中使用）
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('[AddMaterialGinIndex] 开始补充 GIN 索引...');

    // topic_tags GIN 索引
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_material_topic_tags
      ON material_library USING GIN(topic_tags);
    `);
    console.log('[AddMaterialGinIndex] topic_tags GIN 索引已就绪');

    // scene_tags GIN 索引
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_material_scene_tags
      ON material_library USING GIN(scene_tags);
    `);
    console.log('[AddMaterialGinIndex] scene_tags GIN 索引已就绪');

    // emotion_tags GIN 索引（预留，虽然目前召回未使用，但标签扩展时会用到）
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_material_emotion_tags
      ON material_library USING GIN(emotion_tags);
    `);
    console.log('[AddMaterialGinIndex] emotion_tags GIN 索引已就绪');

    return NextResponse.json({
      success: true,
      message: 'material_library JSONB GIN 索引补充完成',
      indexes: ['idx_material_topic_tags', 'idx_material_scene_tags', 'idx_material_emotion_tags'],
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : String(error);
    console.error('[AddMaterialGinIndex] 索引创建失败:', err);
    return NextResponse.json(
      { success: false, error: '索引创建失败', detail: err },
      { status: 500 }
    );
  }
}
