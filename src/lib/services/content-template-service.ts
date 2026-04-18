/**
 * 内容模板服务
 *
 * 负责内容模板的 CRUD 操作、与风格模板的关联管理
 *
 * 🔒 安全原则：所有方法都需要传入 workspaceId 进行权限校验
 */

import { db } from '@/lib/db';
import { contentTemplates } from '@/lib/db/schema/content-template';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import type { CardCountMode, DensityStyle } from '@/lib/db/schema/content-template';
import { generatePromptInstruction } from '@/lib/services/xiaohongshu-visual-analyzer';

// 🔥 安全映射：确保 LLM 返回的值符合 DB 预期
const VALID_CARD_COUNT_MODES = ['3-card', '4-card', '5-card', '6-card', '7-card'];
const VALID_DENSITY_STYLES = ['minimal', 'concise', 'standard', 'detailed'];

function safeCardCountMode(value: string): CardCountMode {
  return (VALID_CARD_COUNT_MODES.includes(value) ? value : '5-card') as CardCountMode;
}

function safeDensityStyle(value: string): DensityStyle {
  return (VALID_DENSITY_STYLES.includes(value) ? value : 'standard') as DensityStyle;
}

// 从 Drizzle 表推断行类型
type ContentTemplateRow = typeof contentTemplates.$inferSelect;

// 从视觉分析器导入类型（避免循环依赖）
type VisualStyleAnalysis = import('@/lib/services/xiaohongshu-visual-analyzer').VisualStyleAnalysis;
type ContentTemplateAnalysis = import('@/lib/services/xiaohongshu-visual-analyzer').ContentTemplate;

export class ContentTemplateService {

  // ==================== 内容模板 CRUD ====================

  /**
   * 创建内容模板（从多模态分析结果）
   *
   * @param workspaceId 工作空间ID
   * @param data 模板数据
   */
  async createTemplate(workspaceId: string, data: {
    name: string;
    description?: string;
    platform?: string;
    styleTemplateId?: string;
    analysis: ContentTemplateAnalysis;
    visualAnalysis?: VisualStyleAnalysis;
    sourceImageHashes?: string[];
  }): Promise<ContentTemplateRow> {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('模板名称不能为空');
    }

    const promptInstruction = this.buildPromptInstruction(data.analysis);

    const [template] = await db.insert(contentTemplates)
      .values({
        workspaceId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        platform: data.platform || 'xiaohongshu',
        styleTemplateId: data.styleTemplateId || null,
        cardCountMode: safeCardCountMode(data.analysis.structure.cardCountMode),
        densityStyle: safeDensityStyle(data.analysis.structure.densityStyle),
        details: {
          cardExamples: data.analysis.cardExamples,
          structure: data.analysis.structure,
          divisionRule: data.analysis.divisionRule,
          textStyleDescription: data.analysis.textStyleDescription,
        },
        promptInstruction,
        sourceType: 'uploaded_note',
        sourceImageHashes: data.sourceImageHashes || [],
        useCount: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log('[ContentTemplateService] ✅ 创建内容模板:', template.id, template.name);
    return template;
  }

  /**
   * 获取工作区的内容模板列表
   *
   * @param workspaceId 工作空间ID
   * @param options 筛选选项
   */
  async listTemplates(
    workspaceId: string,
    options?: {
      platform?: string;
      cardCountMode?: CardCountMode;
      densityStyle?: DensityStyle;
      limit?: number;
      offset?: number;
    }
  ): Promise<ContentTemplateRow[]> {
    // 构建所有筛选条件
    const conditions = [
      eq(contentTemplates.workspaceId, workspaceId),
      eq(contentTemplates.isActive, true),
    ];
    if (options?.platform) {
      conditions.push(eq(contentTemplates.platform, options.platform));
    }
    if (options?.cardCountMode) {
      conditions.push(eq(contentTemplates.cardCountMode, options.cardCountMode));
    }
    if (options?.densityStyle) {
      conditions.push(eq(contentTemplates.densityStyle, options.densityStyle));
    }

    let query = db.select()
      .from(contentTemplates)
      .where(and(...conditions))
      .orderBy(desc(contentTemplates.useCount), desc(contentTemplates.createdAt));

    if (options?.limit) {
      query = query.limit(options.limit) as any;
    }
    if (options?.offset) {
      query = query.offset(options.offset) as any;
    }

    return await query;
  }

  /**
   * 获取单个内容模板详情（带 workspaceId 权限校验）
   */
  async getTemplate(id: string, workspaceId?: string): Promise<ContentTemplateRow | null> {
    const conditions = [eq(contentTemplates.id, id)];
    if (workspaceId) {
      conditions.push(eq(contentTemplates.workspaceId, workspaceId));
    }
    const [template] = await db.select()
      .from(contentTemplates)
      .where(and(...conditions))
      .limit(1);

    return template || null;
  }

  /**
   * 更新内容模板
   */
  async updateTemplate(id: string, workspaceId: string, data: {
    name?: string;
    description?: string;
    isActive?: boolean;
  }): Promise<ContentTemplateRow | null> {
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.description !== undefined) updates.description = data.description?.trim() || null;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    const [template] = await db.update(contentTemplates)
      .set(updates)
      .where(and(eq(contentTemplates.id, id), eq(contentTemplates.workspaceId, workspaceId)))
      .returning();

    return template || null;
  }

  /**
   * 删除内容模板（软删除）— 使用 UPDATE + WHERE 一步完成，避免 TOCTOU 竞态
   */
  async deleteTemplate(id: string, workspaceId: string): Promise<boolean> {
    const result = await db.update(contentTemplates)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(contentTemplates.id, id),
        eq(contentTemplates.workspaceId, workspaceId),
        eq(contentTemplates.isActive, true),  // 只更新未删除的记录
      ))
      .returning();

    return result.length > 0;
  }

  /**
   * 记录使用次数
   */
  async recordUse(id: string): Promise<void> {
    await db.update(contentTemplates)
      .set({
        useCount: sql`COALESCE(${contentTemplates.useCount}, 0) + 1`,
        updatedAt: new Date(),
      })
      .where(eq(contentTemplates.id, id));
  }

  /**
   * 获取最近使用的模板（用于创作引导区域推荐）
   */
  async getRecentUsed(workspaceId: string, limit: number = 5): Promise<ContentTemplateRow[]> {
    return db.select()
      .from(contentTemplates)
      .where(and(
        eq(contentTemplates.workspaceId, workspaceId),
        eq(contentTemplates.isActive, true),
      ))
      .orderBy(desc(contentTemplates.useCount), desc(contentTemplates.updatedAt))
      .limit(limit);
  }

  // ==================== 内部工具方法 ====================

  /**
   * 构建精简 Prompt 指令 — 统一复用 xiaohongshu-visual-analyzer.generatePromptInstruction
   * 避免两处独立实现产生分叉
   */
  private buildPromptInstruction(analysis: ContentTemplateAnalysis): string {
    // 将 service 层的 analysis 结构转换为 visual-analyzer 的 ContentTemplate 格式
    return generatePromptInstruction({
      cardExamples: analysis.cardExamples,
      structure: {
        cardCountMode: analysis.structure.cardCountMode,
        densityStyle: analysis.structure.densityStyle,
        description: analysis.structure.description,
        confidence: 1.0,  // 由 service 层构建时为确定值
      },
      textStyleDescription: analysis.textStyleDescription,
      divisionRule: analysis.divisionRule,
      source: 'default',
    });
  }
}

// 单例导出
export const contentTemplateService = new ContentTemplateService();
