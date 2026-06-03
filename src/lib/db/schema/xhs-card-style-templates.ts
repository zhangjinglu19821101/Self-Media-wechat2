/**
 * 小红书卡片样式模板 Schema
 *
 * 设计理念：
 * 1. 预设模板（system）+ 用户自定义模板（user）并存
 * 2. 模板定义使用 JSONB 存储完整的 XhsCardTemplate 配置
 * 3. 支持手动上传样式 → 保存为自定义模板 → 在卡片选择器中展示
 * 4. 与 xhs-card-templates.ts 中的硬编码模板共享同一类型定义
 */

import { pgTable, text, timestamp, uuid, integer, boolean, jsonb, index } from 'drizzle-orm/pg-core';

// ============================================================
// 表定义
// ============================================================

/**
 * 小红书卡片样式模板表
 * 存储预设和用户自定义的卡片样式配置
 */
export const xhsCardStyleTemplates = pgTable('xhs_card_style_templates', {
  // === 主键 ===
  id: uuid('id').primaryKey().defaultRandom(),

  // === 工作空间归属 ===
  // system 类型模板 workspaceId 为 null，所有用户可见
  // user 类型模板 workspaceId 为用户工作区ID
  workspaceId: text('workspace_id'),

  // === 基本信息 ===
  name: text('name').notNull(),                  // 模板名称
  description: text('description'),              // 模板描述

  // === 模板类型 ===
  // system: 系统预设模板（所有用户可见，仅管理员可管理）
  // user: 用户自定义模板（仅创建者可见）
  templateType: text('template_type').notNull().default('user'), // system / user

  // === 对应的硬编码模板ID（仅 system 类型使用）===
  // 用于关联到 xhs-card-templates.ts 中的预设模板
  presetTemplateId: text('preset_template_id'),

  // === 完整模板配置（JSONB）===
  // 存储 XhsCardTemplate 接口的完整定义
  // 结构与 src/lib/xhs-card-templates.ts 中的 XhsCardTemplate 一致
  templateConfig: jsonb('template_config').notNull(),

  // === 来源追踪 ===
  // manual: 手动创建（通过页面编辑器）
  // uploaded: 从上传的笔记截图中提取
  // preset: 从预设模板初始化
  sourceType: text('source_type').notNull().default('manual'),

  // === 使用统计 ===
  useCount: integer('use_count').notNull().default(0),

  // === 排序 ===
  sortOrder: integer('sort_order').notNull().default(0), // 排序权重，越小越靠前

  // === 状态 ===
  isActive: boolean('is_active').notNull().default(true),

  // === 时间戳 ===
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  idxXhsCardStyleTemplatesWorkspace: index('idx_xhs_card_style_templates_workspace').on(table.workspaceId),
  idxXhsCardStyleTemplatesType: index('idx_xhs_card_style_templates_type').on(table.templateType),
  idxXhsCardStyleTemplatesPresetId: index('idx_xhs_card_style_templates_preset_id').on(table.presetTemplateId),
}));
