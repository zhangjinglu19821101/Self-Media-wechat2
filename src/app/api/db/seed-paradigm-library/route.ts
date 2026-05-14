import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paradigmLibrary } from '@/lib/db/schema/paradigm-library';
import { PARADIGM_SEED_DATA } from '@/lib/db/schema/paradigm-seed-data';
import { eq } from 'drizzle-orm';

// 系统默认工作区ID（种子数据使用固定值）
const SYSTEM_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';

/**
 * POST /api/db/seed-paradigm-library
 * 初始化范式库：插入10套范式（已存在则跳过）
 */
export async function POST() {
  try {
    let inserted = 0;
    let skipped = 0;

    for (const paradigm of PARADIGM_SEED_DATA) {
      // 检查是否已存在
      const existing = await db
        .select({ id: paradigmLibrary.id })
        .from(paradigmLibrary)
        .where(eq(paradigmLibrary.paradigmCode, paradigm.paradigmCode))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      await db.insert(paradigmLibrary).values({
        workspaceId: SYSTEM_WORKSPACE_ID,
        paradigmCode: paradigm.paradigmCode,
        paradigmName: paradigm.paradigmName,
        description: paradigm.description,
        applicableArticleTypes: paradigm.applicableArticleTypes,
        applicableIndustries: paradigm.applicableIndustries,
        applicableSceneKeywords: paradigm.applicableSceneKeywords,
        officialAccountStructure: paradigm.officialAccountStructure,
        xiaohongshuStructure: paradigm.xiaohongshuStructure,
        materialPositionMap: paradigm.materialPositionMap,
        emotionCurve: paradigm.emotionCurve,
        signaturePhrases: paradigm.signaturePhrases,
        sortOrder: paradigm.sortOrder,
        isActive: paradigm.isActive,
        isSystem: paradigm.isSystem,
      });
      inserted++;
    }

    return NextResponse.json({
      success: true,
      message: `范式库初始化完成：新增 ${inserted} 套，跳过 ${skipped} 套（已存在）`,
      total: inserted + skipped,
    });
  } catch (error) {
    console.error('[seed-paradigm-library] 初始化失败:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
