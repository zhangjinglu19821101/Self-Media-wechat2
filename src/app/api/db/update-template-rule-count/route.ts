/**
 * 更新风格模板的规则数量统计
 * 重新计算每个模板的 ruleCount 和 articleCount
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { styleAssets } from '@/lib/db/schema/digital-assets';
import { styleTemplates } from '@/lib/db/schema/style-template';
import { eq, count, and, isNotNull } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('[DB] 开始更新风格模板的规则数量统计...');

    // 1. 获取所有模板
    const templates = await db.select().from(styleTemplates);
    console.log(`[DB] 找到 ${templates.length} 个模板`);

    const results: Array<{
      templateId: string;
      templateName: string;
      oldRuleCount: number;
      newRuleCount: number;
    }> = [];

    // 2. 更新每个模板的 ruleCount
    for (const template of templates) {
      // 统计绑定到该模板的规则数量
      const rules = await db
        .select({ count: count() })
        .from(styleAssets)
        .where(and(
          isNotNull(styleAssets.templateId),
          eq(styleAssets.templateId, template.id)
        ));

      const newRuleCount = rules[0]?.count || 0;

      // 更新模板的 ruleCount
      await db
        .update(styleTemplates)
        .set({ ruleCount: newRuleCount })
        .where(eq(styleTemplates.id, template.id));

      results.push({
        templateId: template.id,
        templateName: template.name,
        oldRuleCount: template.ruleCount || 0,
        newRuleCount,
      });

      console.log(`[DB] 模板 "${template.name}": ${template.ruleCount || 0} → ${newRuleCount} 条规则`);
    }

    return NextResponse.json({
      success: true,
      message: `成功更新 ${templates.length} 个模板的规则数量统计`,
      results,
    });
  } catch (error) {
    console.error('[DB] 更新失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '更新失败',
    }, { status: 500 });
  }
}
