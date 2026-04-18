/**
 * 内容模板（Content Template）Schema
 *
 * 设计理念：
 * - 从参考笔记截图中提取的「内容结构模板」
 * - 与 style_templates 关联但不耦合
 * - 存储图片文字内容、图文分工规则、精简指令
 *
 * 数据流：
 * 用户上传笔记截图 → 多模态分析 → ContentTemplate → 存入此表
 * 任务拆解时选择模板 → 读取精简指令 → 注入 insurance-d Prompt
 */

import { pgTable, text, boolean, timestamp, jsonb, uuid, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ==================== 类型定义 ====================

/** 卡片数量模式 */
export type CardCountMode = '3-card' | '4-card' | '5-card' | '6-card' | '7-card';

/** 内容密度风格 */
export type DensityStyle = 'minimal' | 'concise' | 'standard' | 'detailed';

/** 卡片类型 */
export type CardType = 'cover' | 'point' | 'ending' | 'minimal-point';

/** 文字长度级别 */
export type TextLengthLevel = 'title_only' | 'short' | 'standard' | 'detailed';

// ==================== 内容模板表 ====================
export const contentTemplates = pgTable('content_templates', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 工作空间归属
  workspaceId: text('workspace_id').notNull(),

  // 基本信息
  name: text('name').notNull(), // 模板名称，如"极简4卡-暖色风"
  description: text('description'), // 模板描述

  // 🔥 关联风格模板（可选）
  styleTemplateId: uuid('style_template_id'), // 关联的风格模板ID

  // 平台维度
  platform: text('platform').notNull().default('xiaohongshu'), // 目标平台

  // 结构信息（用于筛选/搜索）
  cardCountMode: text('card_count_mode').notNull().default('5-card'), // 3-card/4-card/5-card/6-card/7-card
  densityStyle: text('density_style').notNull().default('standard'), // minimal/concise/standard/detailed

  // 详细内容（JSONB，存储完整分析结果）
  details: jsonb('details').$type<{
    cardExamples: Array<{
      cardType: CardType;
      imageText: string;
      textLength: TextLengthLevel;
      styleDescription: string;
    }>;
    structure: {
      cardCountMode: CardCountMode;
      densityStyle: DensityStyle;
      description: string;
      confidence: number;
    };
    divisionRule: {
      imageOnly: string[];
      textOnly: string[];
    };
    textStyleDescription?: string;
  }>().notNull(),

  // 🔥 精简指令（用于 Prompt 注入，约50字）
  promptInstruction: text('prompt_instruction').notNull(),

  // 来源追踪
  sourceType: text('source_type').notNull().default('uploaded_note'), // uploaded_note / manual_created
  sourceImageHashes: jsonb('source_image_hashes').$type<string[]>().default([]), // 原始参考图hash列表（用于缓存去重）

  // 使用统计
  useCount: integer('use_count').notNull().default(0), // 被使用次数

  // 状态
  isActive: boolean('is_active').notNull().default(true),

  // 时间戳
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ==================== 关系定义 ====================
export const contentTemplatesRelations = relations(contentTemplates, ({ one }) => ({
  // 可选关联到风格模板（通过 styleTemplateId）
  // 注意：实际关系在运行时通过 service 层处理，此处仅声明
}));
