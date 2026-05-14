/**
 * 创作范式库 Schema
 * 10套固定范式 + 范式-素材映射关系
 * 
 * 核心设计：
 * - 范式锁骨架：每套范式定义公众号7段/小红书版固定结构
 * - 素材位置映射：每个段落对应的素材类型（7维素材对应）
 * - 情绪节奏曲线：对应去AI优化的情绪适配
 */

import { pgTable, uuid, text, timestamp, varchar, jsonb, integer, boolean, index } from 'drizzle-orm/pg-core';

// ==================== 范式库主表 ====================

export const paradigmLibrary = pgTable('paradigm_library', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull(),

  // 范式标识
  paradigmCode: varchar('paradigm_code', { length: 50 }).notNull(), // P001~P010
  paradigmName: varchar('paradigm_name', { length: 100 }).notNull(),
  description: text('description'),
  
  // 适用场景
  applicableArticleTypes: jsonb('applicable_article_types').$type<string[]>().notNull(), // 如 ['客户误区型']
  applicableIndustries: jsonb('applicable_industries').$type<string[]>().default([]),    // 如 ['insurance_life', 'insurance_health']
  applicableSceneKeywords: jsonb('applicable_scene_keywords').$type<string[]>().default([]), // 如 ['回本', '保额']

  // 公众号版结构（7段固定）
  officialAccountStructure: jsonb('official_account_structure').$type<Array<{
    order: number;           // 段落顺序 1-7
    stepName: string;        // 步骤名，如 "错误认知"
    titleTemplate: string;   // 段落标题模板
    contentRequirement: string; // 内容要求
    wordRange: { min: number; max: number };
    required: boolean;
    fixedPhrases: string[];  // 该段落的固定句式（如 "说实话，这种想法我特别理解"）
  }>>().notNull(),

  // 小红书版结构
  xiaohongshuStructure: jsonb('xiaohongshu_structure').$type<Array<{
    order: number;
    stepName: string;
    titleTemplate: string;
    contentRequirement: string;
    wordRange: { min: number; max: number };
    emojiSuggestions: string[];  // 建议添加的emoji
    shortSentence: boolean;     // 是否强制短句
  }>>().notNull(),

  // 素材位置映射：段落 → 素材类型
  materialPositionMap: jsonb('material_position_map').$type<Array<{
    paragraphOrder: number;     // 对应公众号版段落的 order
    stepName: string;           // 步骤名
    materialTypes: string[];    // 该段落需要的素材类型，如 ['misconception', 'fixed_phrase']
    isPrimary: boolean;         // 是否为该段落的主要素材类型
  }>>().notNull(),

  // 情绪节奏曲线
  emotionCurve: jsonb('emotion_curve').$type<Array<{
    paragraphOrder: number;
    stepName: string;
    emotion: string;       // 如 '共情'、'坚定'、'轻松'
    intensity: number;     // 1-10
  }>>().notNull(),

  // 标志性句式（用于范式识别）
  signaturePhrases: jsonb('signature_phrases').$type<string[]>().default([]),

  // 排序与状态
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  isSystem: boolean('is_system').default(false), // 系统内置不可删除

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_paradigm_library_workspace').on(table.workspaceId),
  index('idx_paradigm_library_code').on(table.paradigmCode),
  index('idx_paradigm_library_active').on(table.isActive),
]);

// ==================== 范式使用统计 ====================

export const paradigmUsageStats = pgTable('paradigm_usage_stats', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull(),
  paradigmId: uuid('paradigm_id').notNull().references(() => paradigmLibrary.id),

  usageCount: integer('usage_count').default(0),
  lastUsedAt: timestamp('last_used_at'),
  
  // 平均质量评分
  avgQualityScore: integer('avg_quality_score'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_paradigm_usage_workspace').on(table.workspaceId),
  index('idx_paradigm_usage_paradigm').on(table.paradigmId),
]);
