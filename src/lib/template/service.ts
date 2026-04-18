/**
 * 样式模板服务层
 * 提供模板的增删改查和默认模板管理
 */

import { db } from '@/lib/db';
import { styleTemplates } from './schema';
import { eq, and } from 'drizzle-orm';
import type { StyleTemplate } from './types';

/**
 * 获取指定平台的默认模板
 */
export async function getDefaultTemplate(platform: string): Promise<StyleTemplate | null> {
  console.log(`[TemplateService] 🔍 查询默认模板, platform: ${platform}`);
  
  const result = await db
    .select()
    .from(styleTemplates)
    .where(and(
      eq(styleTemplates.platform, platform),
      eq(styleTemplates.isDefault, true)
    ))
    .limit(1);
  
  if (result[0]) {
    console.log(`[TemplateService] ✅ 找到默认模板: ${result[0].name}, id: ${result[0].id}`);
  } else {
    console.log(`[TemplateService] ⚠️ 未找到默认模板, platform: ${platform}`);
  }
  
  return result[0] || null;
}

/**
 * 设置默认模板
 * 会自动取消同平台其他模板的默认状态
 */
export async function setDefaultTemplate(templateId: string, platform: string): Promise<boolean> {
  console.log(`[TemplateService] 🔄 设置默认模板, templateId: ${templateId}, platform: ${platform}`);
  
  try {
    // 1. 先取消该平台所有模板的默认状态
    const cancelResult = await db
      .update(styleTemplates)
      .set({ isDefault: false })
      .where(eq(styleTemplates.platform, platform));
    console.log(`[TemplateService] 📝 已取消 ${platform} 平台所有模板的默认状态`);
    
    // 2. 设置指定模板为默认
    const result = await db
      .update(styleTemplates)
      .set({ 
        isDefault: true,
        updatedAt: new Date()
      })
      .where(eq(styleTemplates.id, templateId));
    console.log(`[TemplateService] ✅ 已设置模板 ${templateId} 为默认`);
    
    // 3. 验证设置结果
    const verify = await db
      .select()
      .from(styleTemplates)
      .where(eq(styleTemplates.id, templateId))
      .limit(1);
    
    if (verify[0]?.isDefault) {
      console.log(`[TemplateService] ✅ 验证成功: ${verify[0].name} is_default = ${verify[0].isDefault}`);
    } else {
      console.log(`[TemplateService] ⚠️ 验证失败: 模板未正确设置为默认`);
    }
    
    return true;
  } catch (error) {
    console.error('[TemplateService] ❌ 设置默认模板失败:', error);
    return false;
  }
}

/**
 * 获取模板详情
 */
export async function getTemplateById(templateId: string): Promise<StyleTemplate | null> {
  const result = await db
    .select()
    .from(styleTemplates)
    .where(eq(styleTemplates.id, templateId))
    .limit(1);
  
  return result[0] || null;
}

/**
 * 增加模板使用次数
 */
export async function incrementTemplateUseCount(templateId: string): Promise<void> {
  const template = await getTemplateById(templateId);
  if (template) {
    await db
      .update(styleTemplates)
      .set({ 
        useCount: template.useCount + 1,
        updatedAt: new Date()
      })
      .where(eq(styleTemplates.id, templateId));
  }
}

/**
 * 获取所有模板（按平台分组）
 */
export async function getAllTemplates(platform?: string) {
  const conditions = platform ? [eq(styleTemplates.platform, platform)] : [];
  
  const allTemplates = await db
    .select()
    .from(styleTemplates)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(styleTemplates.createdAt);
  
  const systemTemplates = allTemplates.filter(t => t.isSystem);
  const userTemplates = allTemplates.filter(t => !t.isSystem);
  
  return {
    systemTemplates,
    userTemplates,
  };
}
