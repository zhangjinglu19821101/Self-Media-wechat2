/**
 * 数据库迁移 API：新增创作引导相关字段
 * 1. material_library: 新增 scene_type, analysis_text
 * 2. agent_tasks, agent_sub_tasks, daily_task: 新增 structured_data
 */
import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const results: { step: string; status: string; detail?: string }[] = [];

  try {
    const db = getDatabase();

    // Step 1: material_library 新增 scene_type 字段
    try {
      await db.execute(`
        ALTER TABLE material_library
        ADD COLUMN IF NOT EXISTS scene_type TEXT
      `);
      results.push({ step: 'material_library.scene_type', status: 'ok' });
    } catch (e: any) {
      results.push({ step: 'material_library.scene_type', status: 'skip', detail: e.message });
    }

    // Step 2: material_library 新增 analysis_text 字段
    try {
      await db.execute(`
        ALTER TABLE material_library
        ADD COLUMN IF NOT EXISTS analysis_text TEXT
      `);
      results.push({ step: 'material_library.analysis_text', status: 'ok' });
    } catch (e: any) {
      results.push({ step: 'material_library.analysis_text', status: 'skip', detail: e.message });
    }

    // Step 3: agent_tasks 新增 structured_data 字段
    try {
      await db.execute(`
        ALTER TABLE agent_tasks
        ADD COLUMN IF NOT EXISTS structured_data JSONB
      `);
      results.push({ step: 'agent_tasks.structured_data', status: 'ok' });
    } catch (e: any) {
      results.push({ step: 'agent_tasks.structured_data', status: 'skip', detail: e.message });
    }

    // Step 4: agent_sub_tasks 新增 structured_data 字段
    try {
      await db.execute(`
        ALTER TABLE agent_sub_tasks
        ADD COLUMN IF NOT EXISTS structured_data JSONB
      `);
      results.push({ step: 'agent_sub_tasks.structured_data', status: 'ok' });
    } catch (e: any) {
      results.push({ step: 'agent_sub_tasks.structured_data', status: 'skip', detail: e.message });
    }

    // Step 5: daily_task 新增 structured_data 字段
    try {
      await db.execute(`
        ALTER TABLE daily_task
        ADD COLUMN IF NOT EXISTS structured_data JSONB
      `);
      results.push({ step: 'daily_task.structured_data', status: 'ok' });
    } catch (e: any) {
      results.push({ step: 'daily_task.structured_data', status: 'skip', detail: e.message });
    }

    // Step 6: scene_type 索引
    try {
      await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_material_library_scene_type
        ON material_library (scene_type)
        WHERE scene_type IS NOT NULL
      `);
      results.push({ step: 'idx_material_library_scene_type', status: 'ok' });
    } catch (e: any) {
      results.push({ step: 'idx_material_library_scene_type', status: 'skip', detail: e.message });
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message, results },
      { status: 500 }
    );
  }
}
