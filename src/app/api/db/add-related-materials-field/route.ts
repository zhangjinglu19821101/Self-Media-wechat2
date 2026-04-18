/**
 * 数据库迁移：agent_sub_tasks 表新增 related_materials 字段
 * GET /api/db/add-related-materials-field
 *
 * 新增字段说明：
 * - related_materials (TEXT): 关联素材补充区内容（用户手动输入或上传附件）
 * - 与现有 user_opinion 字段配合使用：
 *   - user_opinion: 核心锚点（开篇案例/核心观点/结尾结论）
 *   - key_materials: 本篇关键素材（硬核事实，不可编造）— 复用 user_opinion 的语义
 *   - related_materials: 关联素材（背景知识，灵活参考）— 本次新增
 *
 * Prompt 组装时的区别：
 * - 关键素材(keyMaterials → userOpinion): "必须精准引用，严禁编造"
 * - 关联素材(relatedMaterials): "可参考使用，灵活整合"
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('[AddRelatedMaterialsField] 开始检查/添加 related_materials 字段...');

    // 1. 检查字段是否已存在
    const checkResult = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'agent_sub_tasks' AND column_name = 'related_materials'
    `);

    if (checkResult.length > 0) {
      console.log('[AddRelatedMaterialsField] ✅ related_materials 字段已存在，跳过');
      return NextResponse.json({
        success: true,
        message: 'related_materials 字段已存在，无需迁移',
        status: 'skipped',
      });
    }

    // 2. 添加字段
    await db.execute(sql`
      ALTER TABLE agent_sub_tasks
      ADD COLUMN IF NOT EXISTS related_materials TEXT DEFAULT ''
    `);

    console.log('[AddRelatedMaterialsField] ✅ related_materials 字段添加成功');

    // 3. 验证
    const verifyResult = await db.execute(sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'agent_sub_tasks' AND column_name = 'related_materials'
    `);

    return NextResponse.json({
      success: true,
      message: 'related_materials 字段添加成功',
      status: 'created',
      fieldInfo: verifyResult[0],
      usage: {
        description: '关联素材补充区内容，与 keyMaterials(userOpinion) 区分处理',
        difference: {
          keyMaterials: '本篇关键素材 — 必须精准引用，严禁编造（硬约束）',
          relatedMaterials: '关联素材补充区 — 可参考使用，灵活整合（软参考）',
        },
        promptAssembly: {
          keyMaterialsSection: '【本篇关键素材】必须优先使用，不编造无依据内容',
          relatedMaterialsSection: '【关联素材】可参考使用，灵活整合到文章中',
        },
      },
    });
  } catch (error: any) {
    console.error('[AddRelatedMaterialsField] 迁移失败:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
