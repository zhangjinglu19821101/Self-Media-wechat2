/**
 * 数据库迁移 API：为 material_library 表添加关系型素材上下文字段
 * 
 * 新增字段：
 * - context_before: 素材使用前的上下文（前一句）
 * - context_after: 素材使用后的上下文（后一句）
 * - emotion: 素材承载的情绪标签
 * - relation_to_previous: 与前一个素材的关系
 * - paradigm_step: 在范式结构中的位置（如 P1/P2/P3）
 * - usage_intent: 使用意图说明
 * - transition_phrase: 推荐的过渡句式
 * - original_position: 在原文中的位置索引
 */
import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    const db = getDatabase();
    console.log('[Migration] 开始添加关系型素材上下文字段...');
    
    // 使用原生 SQL 执行迁移
    const migrations = [
      // 添加上下文字段
      `ALTER TABLE material_library ADD COLUMN IF NOT EXISTS context_before TEXT`,
      `ALTER TABLE material_library ADD COLUMN IF NOT EXISTS context_after TEXT`,
      `ALTER TABLE material_library ADD COLUMN IF NOT EXISTS emotion TEXT`,
      `ALTER TABLE material_library ADD COLUMN IF NOT EXISTS relation_to_previous TEXT`,
      `ALTER TABLE material_library ADD COLUMN IF NOT EXISTS paradigm_step TEXT`,
      `ALTER TABLE material_library ADD COLUMN IF NOT EXISTS usage_intent TEXT`,
      `ALTER TABLE material_library ADD COLUMN IF NOT EXISTS transition_phrase TEXT`,
      `ALTER TABLE material_library ADD COLUMN IF NOT EXISTS original_position INTEGER`,
      // 创建索引
      `CREATE INDEX IF NOT EXISTS idx_material_emotion ON material_library(emotion) WHERE emotion IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_material_paradigm_step ON material_library(paradigm_step) WHERE paradigm_step IS NOT NULL`,
    ];
    
    let successCount = 0;
    for (const migrationSql of migrations) {
      try {
        console.log('[Migration] 执行:', migrationSql);
        await db.execute(sql.raw(migrationSql));
        successCount++;
      } catch (err: any) {
        // 忽略 "already exists" 错误
        if (!err.message?.includes('already exists') && !err.message?.includes('duplicate')) {
          console.warn('[Migration] 警告:', err.message);
        }
      }
    }
    
    // 验证迁移结果
    const verifyResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'material_library' 
      AND column_name IN ('context_before', 'context_after', 'emotion', 'relation_to_previous', 'paradigm_step', 'usage_intent', 'transition_phrase', 'original_position')
    `);
    
    const finalColumns = (verifyResult as any[]).map((row: any) => row.column_name) || [];
    
    return NextResponse.json({
      success: true,
      message: `成功执行 ${successCount}/${migrations.length} 条迁移`,
      newFields: finalColumns,
      fieldsCount: finalColumns.length
    });
    
  } catch (error: any) {
    console.error('[Migration] 迁移失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
