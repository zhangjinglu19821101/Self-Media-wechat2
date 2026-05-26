import { NextResponse } from 'next/server';
import { PARADIGM_SEED_DATA } from '@/lib/db/schema/paradigm-seed-data';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

/**
 * POST /api/db/seed-paradigm-library
 * 初始化范式库：插入10套范式到两个 Schema（dev_schema + public）
 * 确保生产环境和开发环境都能看到范式数据
 */
export async function POST() {
  try {
    // 范式是系统级数据，必须同时写入 dev_schema 和 public
    const schemas = ['dev_schema', 'public'];
    const results: Record<string, { inserted: number; skipped: number }> = {};

    // 获取一个系统 workspace_id（用于系统级范式）
    let systemWorkspaceId: string | null = null;
    try {
      const wsResult = await db.execute(sql`
        SELECT id FROM workspaces WHERE name = 'System' OR is_default = true LIMIT 1
      `);
      if ((wsResult as any[]).length > 0) {
        systemWorkspaceId = (wsResult as any[])[0].id;
      }
    } catch {
      // workspaces 表可能不存在，使用占位符
    }

    // 如果没有系统 workspace，尝试获取第一个 workspace
    if (!systemWorkspaceId) {
      try {
        const wsResult = await db.execute(sql`SELECT id FROM workspaces LIMIT 1`);
        if ((wsResult as any[]).length > 0) {
          systemWorkspaceId = (wsResult as any[])[0].id;
        }
      } catch {
        // ignore
      }
    }

    if (!systemWorkspaceId) {
      return NextResponse.json(
        { success: false, error: '无法获取系统 workspace_id，请确保 workspaces 表有数据' },
        { status: 400 }
      );
    }

    for (const schema of schemas) {
      let inserted = 0;
      let skipped = 0;

      for (const paradigm of PARADIGM_SEED_DATA) {
        try {
          // 检查是否已存在
          const existing = await db.execute(sql`
            SELECT id FROM ${sql.raw(schema + '.paradigm_library')} 
            WHERE paradigm_code = ${paradigm.paradigmCode}
            LIMIT 1
          `);

          if ((existing as any[]).length > 0) {
            skipped++;
            continue;
          }

          // 插入种子数据（字段对齐 paradigm-library.ts schema）
          await db.execute(sql`
            INSERT INTO ${sql.raw(schema + '.paradigm_library')} (
              id, workspace_id, paradigm_code, paradigm_name, description,
              is_system, material_position_map, sort_order, 
              applicable_article_types, applicable_industries, applicable_scene_keywords,
              official_account_structure, xiaohongshu_structure,
              emotion_curve, signature_phrases,
              is_active, created_at, updated_at
            ) VALUES (
              gen_random_uuid(), ${systemWorkspaceId}, ${paradigm.paradigmCode}, ${paradigm.paradigmName}, 
              ${paradigm.description || ''}, 
              true,
              ${JSON.stringify(paradigm.materialPositionMap)}::jsonb, 
              ${paradigm.sortOrder || 0},
              ${JSON.stringify(paradigm.applicableArticleTypes || [])}::jsonb,
              ${JSON.stringify(paradigm.applicableIndustries || [])}::jsonb,
              ${JSON.stringify(paradigm.applicableSceneKeywords || [])}::jsonb,
              ${JSON.stringify(paradigm.officialAccountStructure || [])}::jsonb,
              ${JSON.stringify(paradigm.xiaohongshuStructure || [])}::jsonb,
              ${JSON.stringify(paradigm.emotionCurve || [])}::jsonb,
              ${JSON.stringify(paradigm.signaturePhrases || [])}::jsonb,
              true,
              NOW(), NOW()
            )
          `);
          inserted++;
        } catch (e) {
          console.warn(`[seed-paradigm] ${schema}.${paradigm.paradigmCode} 写入失败:`, e instanceof Error ? e.message : String(e));
          skipped++;
        }
      }

      results[schema] = { inserted, skipped };
    }

    const totalInserted = Object.values(results).reduce((sum, r) => sum + r.inserted, 0);
    const totalSkipped = Object.values(results).reduce((sum, r) => sum + r.skipped, 0);

    return NextResponse.json({
      success: true,
      message: `范式库初始化完成：新增 ${totalInserted} 套，跳过 ${totalSkipped} 套`,
      details: results,
      systemWorkspaceId,
    });
  } catch (error) {
    console.error('[seed-paradigm-library] 初始化失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
