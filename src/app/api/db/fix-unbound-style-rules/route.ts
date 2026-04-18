/**
 * 修复未绑定模板的风格规则
 * 将 template_id 为 NULL 的规则绑定到默认模板
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { styleAssets } from '@/lib/db/schema/digital-assets';
import { styleTemplates } from '@/lib/db/schema/style-template';
import { isNull, eq, and } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('[DB] 开始修复未绑定模板的风格规则...');

    // 1. 查找默认模板
    const defaultTemplates = await db
      .select()
      .from(styleTemplates)
      .where(eq(styleTemplates.isDefault, true));

    if (defaultTemplates.length === 0) {
      return NextResponse.json({
        success: false,
        error: '未找到默认模板，请先创建默认模板',
      }, { status: 400 });
    }

    const defaultTemplate = defaultTemplates[0];
    console.log(`[DB] 找到默认模板: ${defaultTemplate.id} (${defaultTemplate.name})`);

    // 2. 查找未绑定模板的规则
    const unboundRules = await db
      .select()
      .from(styleAssets)
      .where(isNull(styleAssets.templateId));

    console.log(`[DB] 找到 ${unboundRules.length} 条未绑定模板的规则`);

    if (unboundRules.length === 0) {
      return NextResponse.json({
        success: true,
        message: '所有规则已绑定模板，无需修复',
        fixedCount: 0,
      });
    }

    // 3. 更新未绑定的规则
    const updatePromises = unboundRules.map(rule =>
      db
        .update(styleAssets)
        .set({ templateId: defaultTemplate.id })
        .where(eq(styleAssets.id, rule.id))
    );

    await Promise.all(updatePromises);

    console.log(`[DB] 成功修复 ${unboundRules.length} 条规则，绑定到模板: ${defaultTemplate.name}`);

    return NextResponse.json({
      success: true,
      message: `成功修复 ${unboundRules.length} 条规则`,
      fixedCount: unboundRules.length,
      defaultTemplate: {
        id: defaultTemplate.id,
        name: defaultTemplate.name,
      },
      fixedRules: unboundRules.map(r => ({
        id: r.id,
        ruleType: r.ruleType,
        ruleContent: r.ruleContent?.slice(0, 50) + '...',
      })),
    });
  } catch (error) {
    console.error('[DB] 修复失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '修复失败',
    }, { status: 500 });
  }
}
