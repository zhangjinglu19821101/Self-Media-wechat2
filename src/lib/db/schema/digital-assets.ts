/**
 * 数字资产 Schema 定义
 * Phase 3 核心：存储用户专属规则、风格规则、核心锚点、反馈迭代等数字资产
 *
 * 三张表：
 * 1. core_anchor_assets   — 核心锚点资产（从 userOpinion/结构模板中自动归档）
 * 2. style_assets         — 风格规则资产（手工录入 + 自动沉淀 + 反馈提取）
 * 3. feedback_assets      — 反馈迭代资产（用户对文章的修改意见，待审核后转为风格规则）
 */

import { pgTable, text, timestamp, jsonb, uuid, integer, numeric, index, boolean } from 'drizzle-orm/pg-core';

// ============================================================
// 类型定义
// ============================================================

/**
 * 核心锚点类型
 */
export type CoreAnchorType =
  | 'opening_case'        // 开头案例
  | 'core_viewpoint'      // 核心观点
  | 'ending_conclusion';  // 结尾结论

/**
 * 风格规则类型（对齐需求文档 3.2.2 节）
 * 
 * 🔥 Phase 小红书支持：新增图文相关规则类型
 * - visual_layout: 小红书/抖音等平台的图文排版风格
 * - title_pattern: 标题套路（悬念式、揭秘式、数字式等）
 * - emoji_usage: emoji 使用习惯
 * - card_style: 卡片视觉风格（配色、装饰等）
 * - image_structure: 图文结构（图片数量模式3/5/7张、图文分工规则、卡片简洁度）
 */
export type StyleRuleType =
  // 通用文字风格规则
  | 'tone'          // 语气基调：共情、理性、警示、温情
  | 'vocabulary'    // 用词习惯：高频词、禁用词、专业术语偏好
  | 'logic'         // 逻辑结构：段落衔接、论证方式、结构偏好
  | 'emotion'       // 情绪表达：情绪触发点、共情策略
  // 小红书/短视频平台特有规则
  | 'title_pattern' // 标题套路：悬念式、揭秘式、数字式、反差式
  | 'emoji_usage'   // emoji 使用：密度、位置、类型偏好
  | 'visual_layout' // 图文排版：图片数量、图文比例、段落长度
  | 'card_style'    // 卡片风格：配色方案、装饰元素、渐变风格
  | 'image_structure'; // 图文结构：图片数量模式(3/5/7)、图文分工、卡片简洁度

/**
 * 风格规则分类
 */
export type RuleCategory = 'positive' | 'negative';
// positive = 正向要求（应该做什么）
// negative = 禁止项（不应该做什么）

/**
 * 规则来源类型
 */
export type AssetSourceType =
  | 'manual'     // 手动录入
  | 'auto_nlp'   // 自动 NLP 提取（词频统计等纯规则方法）
  | 'feedback'   // 从用户反馈中提取
  | 'llm_assist' // LLM 辅助提取（Phase 5）

/**
 * 反馈类型
 */
export type FeedbackType =
  | 'content'    // 内容相关反馈
  | 'style'      // 风格相关反馈
  | 'structure'  // 结构相关反馈
  | 'overall';   // 整体评价

// ============================================================
// 表定义
// ============================================================

/**
 * 核心锚点资产表
 * 存储 insurance-d 执行时使用的核心锚点数据（userOpinion、结构选择等）的归档记录
 */
export const coreAnchorAssets = pgTable('core_anchor_assets', {
  // === 主键 ===
  id: uuid('id').primaryKey().defaultRandom(),

  // === 来源关联 ===
  sourceTaskId: text('source_task_id'),           // 来源子任务 ID

  // === 锚点内容 ===
  anchorType: text('anchor_type').notNull(),      // opening_case / core_viewpoint / ending_conclusion
  rawContent: text('raw_content').notNull(),       // 原始内容文本

  // === NLP 分析结果（预留，Phase 4 填充）===
  extractedKeywords: jsonb('extracted_keywords').$type<string[]>().default([]), // 关键词

  // === 使用统计 ===
  usageCount: integer('usage_count').notNull().default(0),
  isEffective: boolean('is_effective').notNull().default(true),

  // === 工作空间归属（由 user_id 重命名而来）===
  workspaceId: text('workspace_id'),

  // === 时间戳 ===
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  idxCoreAnchorSourceTask: index('idx_core_anchor_source_task').on(table.sourceTaskId),
  idxCoreAnchorType: index('idx_core_anchor_type').on(table.anchorType),
  idxCoreAnchorWorkspaceId: index('idx_core_anchor_workspace_id').on(table.workspaceId),
}));

/**
 * 风格规则资产表
 * 存储用户专属的风格规则（正向要求 + 禁止项），是提示词动态拼接的核心数据源
 * 
 * 🔥 Phase 5.5 更新：新增 template_id 字段，支持风格规则绑定到模板
 */
export const styleAssets = pgTable('style_assets', {
  // === 主键 ===
  id: uuid('id').primaryKey().defaultRandom(),

  // === 规则分类 ===
  ruleType: text('rule_type').notNull(),           // tone / vocabulary / logic / emotion
  ruleContent: text('rule_content').notNull(),     // 规则具体内容
  ruleCategory: text('rule_category').notNull(),   // positive(正向) / negative(禁止)

  // === 来源样本 ===
  sampleExtract: text('sample_extract'),           // 来源样本摘录（帮助理解规则的上下文）

  // === 置信度与优先级 ===
  confidence: numeric('confidence', { precision: 3, scale: 2 }).default('0.50'), // 置信度 0.00-1.00
  priority: integer('priority').notNull().default(2), // 1=最高, 2=高, 3=中, 4=低

  // === 来源与状态 ===
  sourceType: text('source_type').notNull().default('manual'), // manual / auto_nlp / feedback / llm_assist
  isActive: boolean('is_active').notNull().default(true),

  // === 有效期（用于自动降权）===
  validityExpiresAt: timestamp('validity_expires_at'), // 过期时间，NULL 表示永不过期

  // === 工作空间归属（由 user_id 重命名而来）===
  workspaceId: text('workspace_id'),
  templateId: uuid('template_id'), // 绑定的风格模板ID，NULL 表示未绑定（旧数据兼容）

  // === 时间戳 ===
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  idxStyleRuleType: index('idx_style_rule_type').on(table.ruleType),
  idxStyleRuleCategory: index('idx_style_rule_category').on(table.ruleCategory),
  idxStyleActivePriority: index('idx_style_active_priority').on(table.isActive, table.priority),
  idxStyleSourceType: index('idx_style_source_type').on(table.sourceType),
  idxStyleWorkspaceId: index('idx_style_workspace_id').on(table.workspaceId),
  idxStyleValidity: index('idx_style_validity').on(table.validityExpiresAt),
  idxStyleTemplateId: index('idx_style_template_id').on(table.templateId),
}));

/**
 * 反馈迭代资产表
 * 存储用户对已生成文章的反馈，经审核后可转化为 style_assets 规则
 */
export const feedbackAssets = pgTable('feedback_assets', {
  // === 主键 ===
  id: uuid('id').primaryKey().defaultRandom(),

  // === 文章关联 ===
  sourceArticleId: text('source_article_id'),     // 关联的文章 ID（或子任务 ID）

  // === 反馈原始信息 ===
  feedbackType: text('feedback_type').notNull(),   // content / style / structure / overall
  feedbackRaw: text('feedback_raw').notNull(),     // 用户原始反馈文本

  // === 自动提取结果（LLM/NLP 提取，可能为空）===
  extractedRuleType: text('extracted_rule_type'),     // 提取的规则类型
  extractedRuleContent: text('extracted_rule_content'), // 提取的规则内容

  // === 审核状态 ===
  isValidated: boolean('is_validated').notNull().default(false), // 是否已审核通过
  validityExpiresAt: timestamp('validity_expires_at'),          // 审核有效期

  // === 时间戳 ===
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  idxFeedbackArticleId: index('idx_feedback_article_id').on(table.sourceArticleId),
  idxFeedbackType: index('idx_feedback_type').on(table.feedbackType),
  idxFeedbackValidated: index('idx_feedback_validated').on(table.isValidated),
  idxFeedbackExpires: index('idx_feedback_expires').on(table.validityExpiresAt),
}));

// ============================================================
// 类型导出（Drizzle 推断）
// ============================================================

export type CoreAnchorAsset = typeof coreAnchorAssets.$inferSelect;
export type NewCoreAnchorAsset = typeof coreAnchorAssets.$inferInsert;

export type StyleAsset = typeof styleAssets.$inferSelect;
export type NewStyleAsset = typeof styleAssets.$inferInsert;

export type FeedbackAsset = typeof feedbackAssets.$inferSelect;
export type NewFeedbackAsset = typeof feedbackAssets.$inferInsert;
